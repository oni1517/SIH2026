import re
import queue
import socket
import subprocess
import threading
import time
import ctypes
from pathlib import Path

import cv2
import numpy as np
import pyrealsense2 as rs

try:
    from ultralytics import YOLO
except ImportError:
    YOLO = None


# ============================================================
# SETTINGS
# ============================================================

WIDTH = 640
HEIGHT = 480
FPS = 30

WIFI_REFRESH_SECONDS = 5
WIFI_SCAN_SETTLE_SECONDS = 1.5
LAN_REFRESH_SECONDS = 30
MAX_WIFI_DISPLAY = 5
MAX_LAN_DISPLAY = 6
NODE_SSID_PATTERN = re.compile(r"^node", re.IGNORECASE)
FULLSCREEN = True
VOICE_ALERTS = True
VOICE_REPEAT_SECONDS = 20
ROVER_MIN_PASSAGE_WIDTH_M = 0.80
ROVER_MIN_PASSAGE_HEIGHT_M = 1.00

MIN_DEPTH_M = 0.3
MAX_DEPTH_M = 8.0
POINT_CLOUD_STEP = 8

PASSAGE_X_MIN = 0.10
PASSAGE_X_MAX = 0.90
PASSAGE_Y_MIN = 0.10
PASSAGE_Y_MAX = 0.90

POSE_MODEL_PATH = "yolo11n-pose.pt"
PERSON_MODEL_PATH = "yolo11n.pt"
POSE_EVERY_N_FRAMES = 3
POSE_CONFIDENCE = 0.45

BODY_PARTS = {
    0: "nose",
    5: "left shoulder",
    6: "right shoulder",
    7: "left elbow",
    8: "right elbow",
    9: "left wrist",
    10: "right wrist",
    11: "left hip",
    12: "right hip",
    13: "left knee",
    14: "right knee",
    15: "left ankle",
    16: "right ankle",
}

WINDOW_NAME = "D435 Wi-Fi and Local Network Scanner"

ENABLE_LOCAL_LAN_SCAN = True
EXCLUDE_CONNECTED_WIFI = False


# ============================================================
# SHARED RESULTS
# ============================================================

results_lock = threading.Lock()
wifi_networks = []
lan_devices = []
wifi_error = None
lan_error = None
connected_wifi_ssid = None
stop_event = threading.Event()
voice_queue = queue.Queue(maxsize=32)


class WindowsGuid(ctypes.Structure):
    _fields_ = [
        ("data1", ctypes.c_ulong),
        ("data2", ctypes.c_ushort),
        ("data3", ctypes.c_ushort),
        ("data4", ctypes.c_ubyte * 8),
    ]


def request_windows_wifi_scan():
    """Ask every Windows WLAN interface to perform an active scan."""
    if not hasattr(ctypes, "windll"):
        return False

    wlanapi = ctypes.windll.wlanapi
    handle = ctypes.c_void_p()
    negotiated_version = ctypes.c_ulong()
    interface_list = ctypes.c_void_p()

    result = wlanapi.WlanOpenHandle(
        2,
        None,
        ctypes.byref(negotiated_version),
        ctypes.byref(handle),
    )
    if result != 0:
        return False

    try:
        result = wlanapi.WlanEnumInterfaces(
            handle,
            None,
            ctypes.byref(interface_list),
        )
        if result != 0 or not interface_list.value:
            return False

        raw = ctypes.string_at(interface_list.value, 8)
        interface_count = int.from_bytes(raw[:4], "little")
        interface_size = ctypes.sizeof(WindowsGuid) + 4 + (256 * 2)
        interface_base = interface_list.value + 8

        for index in range(interface_count):
            offset = interface_base + index * interface_size
            interface_guid = WindowsGuid.from_buffer_copy(
                ctypes.string_at(offset, ctypes.sizeof(WindowsGuid))
            )
            wlanapi.WlanScan(
                handle,
                ctypes.byref(interface_guid),
                None,
                None,
                None,
            )
        return True
    finally:
        if interface_list.value:
            wlanapi.WlanFreeMemory(interface_list)
        wlanapi.WlanCloseHandle(handle, None)


def announce(message):
    """Queue a short Windows voice alert without blocking camera frames."""
    if not VOICE_ALERTS:
        return
    try:
        voice_queue.put_nowait(message)
    except queue.Full:
        pass


def voice_worker():
    """Speak queued alerts using Windows built-in System.Speech."""
    while not stop_event.is_set() or not voice_queue.empty():
        try:
            message = voice_queue.get(timeout=0.5)
        except queue.Empty:
            continue

        escaped = message.replace("'", "''")
        command = (
            "Add-Type -AssemblyName System.Speech; "
            "$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
            "$female = $voice.GetInstalledVoices() | "
            "Where-Object { $_.VoiceInfo.Gender.ToString() -eq 'Female' } | "
            "Select-Object -First 1; "
            "if ($female) { $voice.SelectVoice($female.VoiceInfo.Name) }; "
            "$voice.Volume = 100; $voice.Rate = 0; "
            f"$voice.Speak('{escaped}'); $voice.Dispose()"
        )
        try:
            speech_result = subprocess.run(
                ["powershell", "-NoProfile", "-STA", "-Command", command],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=15,
                check=False,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
            if speech_result.returncode != 0:
                print("Voice alert failed with PowerShell exit code "
                      f"{speech_result.returncode}.")
        except (OSError, subprocess.TimeoutExpired):
            print("Voice alert could not start Windows Speech.")


def get_connected_wifi_ssid():
    result = subprocess.run(
        ["netsh", "wlan", "show", "interfaces"],
        capture_output=True,
        text=True,
        timeout=10,
        check=False,
    )

    if result.returncode != 0:
        return None

    for line in result.stdout.splitlines():
        match = re.match(r"\s*SSID\s*:\s*(.*)", line)
        if match:
            return match.group(1).strip() or None

    return None


def scan_wifi_access_points():
    if request_windows_wifi_scan():
        time.sleep(WIFI_SCAN_SETTLE_SECONDS)
    result = subprocess.run(
        ["netsh", "wlan", "show", "networks", "mode=bssid"],
        capture_output=True,
        text=True,
        timeout=20,
        check=False,
    )

    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "netsh Wi-Fi scan failed")

    networks = []
    current_ssid = None
    current_bssid = None
    connected_ssid = get_connected_wifi_ssid() if EXCLUDE_CONNECTED_WIFI else None

    for line in result.stdout.splitlines():
        ssid_match = re.match(r"\s*SSID\s+\d+\s*:\s*(.*)", line)
        signal_match = re.match(r"\s*Signal\s*:\s*(\d+)%", line)

        if ssid_match:
            current_ssid = ssid_match.group(1).strip() or "(hidden network)"
            current_bssid = None
        elif line.strip().lower().startswith("bssid "):
            bssid_match = re.search(
                r"BSSID\s+\d+\s*:\s*([0-9a-fA-F:-]{17})",
                line,
            )
            current_bssid = bssid_match.group(1).upper() if bssid_match else None
        elif signal_match and current_ssid is not None:
            if (
                NODE_SSID_PATTERN.match(current_ssid)
                and current_ssid != connected_ssid
            ):
                networks.append({
                    "ssid": current_ssid,
                    "bssid": current_bssid or "unknown",
                    "signal": int(signal_match.group(1)),
                })

    strongest = {}
    for network in networks:
        radio_id = network["bssid"]
        if (
            radio_id not in strongest
            or network["signal"] > strongest[radio_id]["signal"]
        ):
            strongest[radio_id] = network

    ranked = sorted(
        strongest.values(),
        key=lambda item: item["signal"],
        reverse=True,
    )
    for network in ranked:
        network["node"] = network["ssid"]
    return ranked


def wifi_worker():
    global wifi_networks, wifi_error, connected_wifi_ssid

    while not stop_event.is_set():
        try:
            connected = get_connected_wifi_ssid()
            found = scan_wifi_access_points()
            with results_lock:
                connected_wifi_ssid = connected
                if found:
                    wifi_networks = found
                    wifi_error = None
                elif wifi_networks:
                    wifi_error = "Refresh found no nearby access points; retaining last result"
                else:
                    wifi_error = "No nearby Wi-Fi access points currently visible"
        except Exception as exc:
            with results_lock:
                wifi_error = str(exc)

        stop_event.wait(WIFI_REFRESH_SECONDS)


# ============================================================
# LOCAL NETWORK DISCOVERY (BEST EFFORT)
# ============================================================

def get_local_ipv4_networks():
    """Find local IPv4 interfaces and subnet masks using ipconfig."""
    result = subprocess.run(
        ["ipconfig"],
        capture_output=True,
        text=True,
        timeout=15,
        check=False,
    )

    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "ipconfig failed")

    networks = []
    current_ip = None

    for line in result.stdout.splitlines():
        ip_match = re.search(
            r"(?:IPv4 Address|IPv4 Address\.)[^:]*:\s*([\d.]+)",
            line,
            re.IGNORECASE,
        )
        mask_match = re.search(
            r"Subnet Mask[^:]*:\s*([\d.]+)",
            line,
            re.IGNORECASE,
        )

        if ip_match:
            current_ip = ip_match.group(1)

        if mask_match and current_ip:
            try:
                ip_int = int.from_bytes(socket.inet_aton(current_ip), "big")
                mask_int = int.from_bytes(
                    socket.inet_aton(mask_match.group(1)), "big"
                )
                network_int = ip_int & mask_int
                broadcast_int = network_int | (~mask_int & 0xFFFFFFFF)

                network_address = socket.inet_ntoa(
                    network_int.to_bytes(4, "big")
                )
                broadcast_address = socket.inet_ntoa(
                    broadcast_int.to_bytes(4, "big")
                )

                networks.append(
                    (current_ip, network_address, broadcast_address)
                )
            except OSError:
                pass

            current_ip = None

    return networks


def ping_host(ip):
    """Briefly ping a local IP; some devices block ping."""
    try:
        subprocess.run(
            ["ping", "-n", "1", "-w", "250", ip],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=2,
            check=False,
        )
    except (subprocess.TimeoutExpired, OSError):
        pass


def scan_local_lan():
    """
    Populate Windows' ARP cache by pinging addresses on the local subnet,
    then return cached IP/MAC pairs. This may miss devices.
    """
    interfaces = get_local_ipv4_networks()
    if not interfaces:
        return []

    local_ip, network_address, broadcast_address = interfaces[0]
    network_parts = network_address.split(".")
    broadcast_parts = broadcast_address.split(".")

    # Limit active scanning to a /24-sized range.
    if network_parts[:3] == broadcast_parts[:3]:
        targets = [
            f"{network_parts[0]}.{network_parts[1]}.{network_parts[2]}.{i}"
            for i in range(1, 255)
            if f"{network_parts[0]}.{network_parts[1]}.{network_parts[2]}.{i}"
            != local_ip
        ]
    else:
        targets = []

    threads = []
    for ip in targets:
        thread = threading.Thread(
            target=ping_host,
            args=(ip,),
            daemon=True,
        )
        thread.start()
        threads.append(thread)

    for thread in threads:
        thread.join(timeout=0.5)

    result = subprocess.run(
        ["arp", "-a"],
        capture_output=True,
        text=True,
        timeout=15,
        check=False,
    )

    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "arp command failed")

    devices = []
    for line in result.stdout.splitlines():
        match = re.search(
            r"^\s*([\d.]+)\s+([0-9a-fA-F-]{17})\s+\w+",
            line,
        )
        if match:
            ip = match.group(1)
            mac = match.group(2).replace("-", ":").upper()

            if ip != local_ip:
                devices.append({"ip": ip, "mac": mac})

    unique = {device["ip"]: device for device in devices}

    def ip_sort_key(device):
        try:
            return tuple(int(part) for part in device["ip"].split("."))
        except ValueError:
            return (0, 0, 0, 0)

    return sorted(unique.values(), key=ip_sort_key)


def lan_worker():
    global lan_devices, lan_error

    while not stop_event.is_set():
        if not ENABLE_LOCAL_LAN_SCAN:
            stop_event.wait(1)
            continue

        try:
            found = scan_local_lan()
            with results_lock:
                lan_devices = found
                lan_error = None
        except Exception as exc:
            with results_lock:
                lan_error = str(exc)

        stop_event.wait(LAN_REFRESH_SECONDS)


# ============================================================
# REALSENSE / DISPLAY HELPERS
# ============================================================

def draw_text(image, text, x, y, color=(255, 255, 255), scale=0.5):
    cv2.putText(
        image,
        str(text),
        (int(x), int(y)),
        cv2.FONT_HERSHEY_SIMPLEX,
        scale,
        color,
        1,
        cv2.LINE_AA,
    )


def collect_points(depth_frame):
    intrinsics = (
        depth_frame.profile
        .as_video_stream_profile()
        .get_intrinsics()
    )

    points = []

    for y in range(0, HEIGHT, POINT_CLOUD_STEP):
        for x in range(0, WIDTH, POINT_CLOUD_STEP):
            depth = depth_frame.get_distance(x, y)

            if MIN_DEPTH_M <= depth <= MAX_DEPTH_M:
                point = rs.rs2_deproject_pixel_to_point(
                    intrinsics,
                    [x, y],
                    depth,
                )
                points.append(point)

    return points


def estimate_scene(points):
    if len(points) < 10:
        return None

    points = np.asarray(points)
    width_m = (
        np.percentile(points[:, 0], 98)
        - np.percentile(points[:, 0], 2)
    )
    height_m = (
        np.percentile(points[:, 1], 98)
        - np.percentile(points[:, 1], 2)
    )
    distance_m = float(np.median(points[:, 2]))

    return width_m, height_m, distance_m


def estimate_passage(depth_frame):
    """Estimate dimensions from valid depth samples in the central image area."""
    intrinsics = (
        depth_frame.profile
        .as_video_stream_profile()
        .get_intrinsics()
    )

    points = []
    x_start = int(WIDTH * PASSAGE_X_MIN)
    x_end = int(WIDTH * PASSAGE_X_MAX)
    y_start = int(HEIGHT * PASSAGE_Y_MIN)
    y_end = int(HEIGHT * PASSAGE_Y_MAX)

    for y in range(y_start, y_end, POINT_CLOUD_STEP):
        for x in range(x_start, x_end, POINT_CLOUD_STEP):
            depth = depth_frame.get_distance(x, y)

            if MIN_DEPTH_M <= depth <= MAX_DEPTH_M:
                points.append(
                    rs.rs2_deproject_pixel_to_point(
                        intrinsics,
                        [x, y],
                        depth,
                    )
                )

    if len(points) < 10:
        return None

    points = np.asarray(points)
    width_m = (
        np.percentile(points[:, 0], 98)
        - np.percentile(points[:, 0], 2)
    )
    height_m = (
        np.percentile(points[:, 1], 98)
        - np.percentile(points[:, 1], 2)
    )

    return width_m, height_m


def depth_at_pixel(depth_frame, x, y):
    """Return median depth around a pixel, or None if no valid depth exists."""
    x = int(round(x))
    y = int(round(y))
    values = []

    for sample_y in range(max(0, y - 2), min(HEIGHT, y + 3)):
        for sample_x in range(max(0, x - 2), min(WIDTH, x + 3)):
            depth = depth_frame.get_distance(sample_x, sample_y)
            if MIN_DEPTH_M <= depth <= MAX_DEPTH_M:
                values.append(depth)

    return float(np.median(values)) if values else None


def detect_body_parts(pose_model, image, depth_frame):
    """Attach depth to visible landmarks for every detected person."""
    if pose_model is None:
        return []

    result = pose_model.predict(
        image,
        conf=POSE_CONFIDENCE,
        verbose=False,
    )[0]

    if result.keypoints is None or len(result.keypoints.xy) == 0:
        return []

    all_keypoints = result.keypoints.xy.cpu().numpy()

    confidence = result.keypoints.conf
    if confidence is not None:
        confidence = confidence.cpu().numpy()

    measurements = []
    for person_index, keypoints in enumerate(all_keypoints):
        for index, label in BODY_PARTS.items():
            if index >= len(keypoints):
                continue

            if (
                confidence is not None
                and confidence[person_index][index] < POSE_CONFIDENCE
            ):
                continue

            x, y = keypoints[index]

            if not (0 <= x < WIDTH and 0 <= y < HEIGHT):
                continue

            distance = depth_at_pixel(depth_frame, x, y)
            if distance is not None:
                measurements.append(
                    (f"P{person_index + 1} {label}", int(x), int(y), distance)
                )

    return measurements


def draw_body_measurements(image, measurements):
    for label, x, y, distance in measurements:
        cv2.circle(image, (x, y), 4, (0, 165, 255), -1)
        draw_text(
            image,
            f"{label}: {distance:.2f}m",
            x + 5,
            max(14, y - 5),
            (0, 165, 255),
            0.38,
        )


def make_depth_preview(depth_frame):
    depth = np.asanyarray(depth_frame.get_data())
    valid = depth > 0

    if not np.any(valid):
        return np.zeros((HEIGHT, WIDTH, 3), dtype=np.uint8)

    clipped = np.clip(
        depth,
        0,
        int(MAX_DEPTH_M * 1000),
    ).astype(np.uint16)

    preview = (clipped / (MAX_DEPTH_M * 10)).astype(np.uint8)
    preview = cv2.applyColorMap(preview, cv2.COLORMAP_TURBO)
    preview[~valid] = (0, 0, 0)

    return preview


def detect_persons(person_model, image):
    if person_model is None:
        return []

    result = person_model.predict(
        image,
        conf=POSE_CONFIDENCE,
        verbose=False,
    )[0]

    if result.boxes is None or len(result.boxes) == 0:
        return []

    boxes = result.boxes
    classes = boxes.cls.cpu().numpy()
    person_indexes = np.flatnonzero(classes == 0)

    if len(person_indexes) == 0:
        return []

    confidences = boxes.conf.cpu().numpy()
    coordinates = boxes.xyxy.cpu().numpy()

    detections = []
    for index in person_indexes:
        x1, y1, x2, y2 = coordinates[index].astype(int)
        detections.append((x1, y1, x2, y2, float(confidences[index])))

    return detections


def draw_person_detection(image, detection):
    for person_number, (x1, y1, x2, y2, confidence) in enumerate(
        detection or [],
        start=1,
    ):
        cv2.rectangle(image, (x1, y1), (x2, y2), (0, 255, 0), 2)
        draw_text(
            image,
            f"PERSON {person_number} {confidence:.0%}",
            x1,
            max(18, y1 - 6),
            (0, 255, 0),
            0.5,
        )


def save_point_cloud(points, filename):
    with open(filename, "w", encoding="ascii") as file:
        file.write("ply\n")
        file.write("format ascii 1.0\n")
        file.write(f"element vertex {len(points)}\n")
        file.write("property float x\n")
        file.write("property float y\n")
        file.write("property float z\n")
        file.write("end_header\n")

        for x, y, z in points:
            file.write(f"{x:.5f} {y:.5f} {z:.5f}\n")


# ============================================================
# MAIN
# ============================================================

def main():
    global wifi_networks, lan_devices, wifi_error, lan_error

    pipeline = rs.pipeline()
    config = rs.config()
    config.enable_stream(
        rs.stream.color,
        WIDTH,
        HEIGHT,
        rs.format.bgr8,
        FPS,
    )
    config.enable_stream(
        rs.stream.depth,
        WIDTH,
        HEIGHT,
        rs.format.z16,
        FPS,
    )

    pipeline_started = False
    pose_model = None
    person_model = None
    pose_status = "YOLO not installed"

    if YOLO is not None:
        model_directory = Path(__file__).resolve().parent
        pose_path = model_directory / POSE_MODEL_PATH
        person_path = model_directory / PERSON_MODEL_PATH

        if pose_path.exists():
            try:
                pose_model = YOLO(str(pose_path))
                pose_status = "Pose landmarks enabled"
            except Exception as exc:
                pose_status = f"Pose model error: {str(exc)[:35]}"
        else:
            pose_status = "Pose weights missing"

        if person_path.exists():
            try:
                person_model = YOLO(str(person_path))
            except Exception as exc:
                pose_status = f"Person model error: {str(exc)[:35]}"

    try:
        pipeline.start(config)
        pipeline_started = True
        align = rs.align(rs.stream.color)

        threading.Thread(target=wifi_worker, daemon=True).start()
        threading.Thread(target=lan_worker, daemon=True).start()
        voice_thread = threading.Thread(target=voice_worker, daemon=True)
        voice_thread.start()

        cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_NORMAL)
        fullscreen = FULLSCREEN
        if fullscreen:
            cv2.setWindowProperty(
                WINDOW_NAME,
                cv2.WND_PROP_FULLSCREEN,
                cv2.WINDOW_FULLSCREEN,
            )

        print("D435 Wi-Fi and Local Network Scanner")
        print("ESC: exit | S: save screenshot and point cloud")
        print("LAN discovery is best effort; check your router for a full list.")
        print("F: toggle fullscreen | Voice alerts: enabled")

        frame_number = 0
        body_measurements = []
        person_detections = []
        previous_person = False
        previous_person_count = 0
        announced_lan = set()
        last_voice_alert = {}
        last_connected_wifi = None

        def speak_once(key, message):
            now = time.monotonic()
            if now - last_voice_alert.get(key, 0) >= VOICE_REPEAT_SECONDS:
                last_voice_alert[key] = now
                announce(message)

        while True:
            frame_number += 1
            frames = pipeline.wait_for_frames()
            aligned_frames = align.process(frames)

            color_frame = aligned_frames.get_color_frame()
            depth_frame = aligned_frames.get_depth_frame()

            if not color_frame or not depth_frame:
                continue

            image = np.asanyarray(color_frame.get_data())
            points = collect_points(depth_frame)
            scene = estimate_scene(points)
            passage = estimate_passage(depth_frame)
            depth_preview = make_depth_preview(depth_frame)

            if frame_number % POSE_EVERY_N_FRAMES == 0:
                if person_model is not None:
                    try:
                        person_detections = detect_persons(person_model, image)
                    except Exception as exc:
                        person_detections = []
                        pose_status = f"Person detection error: {str(exc)[:30]}"

                if pose_model is not None:
                    try:
                        body_measurements = detect_body_parts(
                            pose_model,
                            image,
                            depth_frame,
                        )
                    except Exception as exc:
                        body_measurements = []
                        pose_status = f"Pose error: {str(exc)[:35]}"

            with results_lock:
                current_wifi = wifi_networks[:]
                current_lan = lan_devices[:]
                current_wifi_error = wifi_error
                current_lan_error = lan_error
                current_connected_wifi = connected_wifi_ssid

            if current_connected_wifi != last_connected_wifi:
                if current_connected_wifi:
                    announce(f"Wi-Fi connected to {current_connected_wifi}.")
                elif last_connected_wifi:
                    announce("Wi-Fi disconnected.")
                last_connected_wifi = current_connected_wifi

            # Dark translucent dashboard panel.
            panel = image.copy()
            cv2.rectangle(panel, (8, 8), (625, 465), (0, 0, 0), -1)
            image = cv2.addWeighted(panel, 0.42, image, 0.58, 0)

            body_summary = [
                measurement
                for measurement in body_measurements
                if measurement[0].endswith(("nose", "shoulder"))
            ][:6]

            # Keep detection graphics bright over the dashboard.
            draw_person_detection(image, person_detections)
            draw_body_measurements(image, body_measurements)

            # Header and scene measurements.
            draw_text(
                image,
                "D435 WI-FI + LOCAL NETWORK",
                18,
                30,
                (0, 255, 255),
                0.62,
            )

            if scene:
                width_m, height_m, distance_m = scene
                draw_text(image, f"Scene width: {width_m:.2f} m", 18, 55,
                          (0, 255, 0), 0.44)
                draw_text(image, f"Scene height: {height_m:.2f} m", 18, 75,
                          (0, 255, 0), 0.44)
                draw_text(image, f"Median depth: {distance_m:.2f} m", 18, 95,
                          (0, 255, 255), 0.44)
            else:
                draw_text(image, "Depth measurements unavailable", 18, 62,
                          (0, 165, 255), 0.42)

            if passage:
                passage_width, passage_height = passage
                draw_text(image, f"Passage width: {passage_width:.2f} m",
                          320, 55, (0, 255, 0), 0.42)
                draw_text(image, f"Passage height: {passage_height:.2f} m",
                          320, 75, (0, 255, 0), 0.42)
            else:
                draw_text(image, "Passage dimensions unavailable",
                          320, 62, (0, 165, 255), 0.40)

            draw_text(image, pose_status[:42], 320, 95, (0, 165, 255), 0.38)

            # Wi-Fi section.
            draw_text(
                image,
                "NODE SSIDS ONLY (refresh every 5s; strongest first)",
                18,
                124,
                (255, 220, 0),
                0.40,
            )

            if not current_wifi:
                draw_text(image, "Scanning...", 18, 146, (0, 165, 255), 0.42)
            else:
                for index, network in enumerate(
                    current_wifi[:MAX_WIFI_DISPLAY]
                ):
                    label = (
                        f"{network['ssid'][:20]} "
                        f"{network['bssid'][-5:]} "
                        f"{network['signal']}%"
                    )
                    draw_text(
                        image,
                        label,
                        18,
                        146 + index * 18,
                        (0, 255, 0) if index == 0 else (220, 220, 220),
                        0.40,
                    )
                if current_wifi_error:
                    draw_text(image, "Refreshing; last node result retained",
                              18, 240, (0, 165, 255), 0.34)
            if not current_wifi and current_wifi_error:
                draw_text(image, current_wifi_error[:58], 18, 166,
                          (0, 0, 255), 0.36)

            # Body-part section.
            draw_text(
                image,
                "BODY PART DISTANCES (all people)",
                320,
                124,
                (255, 220, 0),
                0.40,
            )

            if body_summary:
                for index, (label, _, _, distance) in enumerate(body_summary):
                    draw_text(
                        image,
                        f"{label}: {distance:.2f} m",
                        320,
                        146 + index * 17,
                        (0, 165, 255),
                        0.38,
                    )
            else:
                draw_text(
                    image,
                    "No valid body landmarks",
                    320,
                    146,
                    (0, 165, 255),
                    0.38,
                )

            # Wi-Fi proximity summary. Signal is a relative closeness proxy,
            # not a physical distance measurement.
            lan_y = 270
            draw_text(
                image,
                "NEAREST WI-FI NODE (SIGNAL PROXY)",
                18,
                lan_y,
                (255, 220, 0),
                0.40,
            )

            if not current_wifi:
                draw_text(
                    image,
                    "No nearby access points found.",
                    18,
                    lan_y + 21,
                    (0, 165, 255),
                    0.38,
                )
            else:
                nearest = current_wifi[0]
                draw_text(image, f"{nearest['ssid'][:27]}  "
                          f"{nearest['signal']}% signal",
                          18, lan_y + 21, (0, 255, 0), 0.42)
                draw_text(image, "Higher signal usually means closer node.",
                          18, lan_y + 40, (220, 220, 220), 0.36)
                draw_text(image, "Not a measured distance or device ID.",
                          18, lan_y + 58, (220, 220, 220), 0.36)

            # Depth preview is drawn once per frame, independent of LAN results.
            preview_width = 180
            preview_height = 120
            depth_small = cv2.resize(
                depth_preview,
                (preview_width, preview_height),
            )
            image[335:455, 435:615] = depth_small
            cv2.rectangle(
                image,
                (435, 335),
                (615, 455),
                (255, 255, 255),
                1,
            )
            draw_text(image, "DEPTH FEED", 442, 350, (255, 255, 255), 0.38)

            cv2.imshow(WINDOW_NAME, image)
            key = cv2.waitKey(1) & 0xFF

            if key == 27:
                break

            if key == ord("f"):
                fullscreen = not fullscreen
                cv2.setWindowProperty(
                    WINDOW_NAME,
                    cv2.WND_PROP_FULLSCREEN,
                    cv2.WINDOW_FULLSCREEN if fullscreen else cv2.WINDOW_NORMAL,
                )

            if key == ord("s"):
                timestamp = time.strftime("%Y%m%d_%H%M%S")
                image_file = f"scanner_{timestamp}.jpg"
                cloud_file = f"scanner_{timestamp}.ply"

                cv2.imwrite(image_file, image)
                save_point_cloud(points, cloud_file)

                print(f"Saved screenshot: {image_file}")
                print(f"Saved point cloud: {cloud_file}")

    except KeyboardInterrupt:
        print("\nStopped by Ctrl+C.")
    except Exception as exc:
        print(f"Application error: {exc}")
    finally:
        stop_event.set()

        if pipeline_started:
            pipeline.stop()

        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()