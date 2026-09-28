# RealSense Human Detection & Network Scanner

A Windows-based Intel RealSense D435 application that combines:

- 🎥 RealSense D435 color + depth streaming
- 👤 YOLO person detection
- 🦴 YOLO pose/body-part depth measurements
- 📏 Scene width, height, median depth and passage estimation
- 📡 Wi-Fi node discovery
- 🌐 Local LAN device discovery
- 🔊 Windows voice alerts
- 💾 Screenshot + point-cloud export

> **Important:** This project currently depends on Windows commands/APIs such as `netsh`, `ipconfig`, `arp`, `ping`, PowerShell Speech, and Windows WLAN APIs. It is therefore intended to run on **Windows**, not Linux/macOS.

## 1. Requirements

### Hardware

- Intel RealSense D435
- USB 3.0 connection
- Windows PC
- Internet connection for installing Python packages

### Software

- Windows 10/11
- Python **3.10–3.13 recommended**
- Intel RealSense SDK 2.0
- RealSense Python bindings
- OpenCV
- NumPy
- Ultralytics YOLO

Python 3.14 may not have compatible wheels for every dependency, so Python 3.11 or 3.12 is recommended.

## 2. Clone the Repository

```powershell
git clone https://github.com/YOUR_USERNAME/RealSense_human_detection.git
cd RealSense_human_detection
```

## 3. Create a Virtual Environment

```powershell
py -3.11 -m venv .venv
```

Activate it:

```powershell
.venv\Scripts\activate
```

You should now see:

```text
(.venv)
```

in your terminal.

## 4. Install Python Dependencies

Upgrade pip:

```powershell
python -m pip install --upgrade pip
```

Install the required packages:

```powershell
pip install opencv-python numpy pyrealsense2 ultralytics
```

Or install from the included requirements file:

```powershell
pip install -r requirements.txt
```

## 5. RealSense SDK

Install the official **Intel RealSense SDK 2.0** on Windows.

After installation, connect the D435 and verify that it is detected using Intel RealSense Viewer.

The application expects:

```text
Color: 640 × 480 @ 30 FPS
Depth: 640 × 480 @ 30 FPS
```

These settings are defined in the source code. fileciteturn0file0L24-L26

## 6. YOLO Models

Place these model files in the **same directory as `detection.py`**:

```text
yolo11n.pt
yolo11n-pose.pt
```

The program specifically looks for these filenames relative to the Python script. fileciteturn0file0L49-L51

Recommended project structure:

```text
RealSense_human_detection/
│
├── detection.py
├── requirements.txt
├── README.md
├── yolo11n.pt
└── yolo11n-pose.pt
```

## 7. Run

With the virtual environment activated:

```powershell
python detection.py
```

If you have multiple Python installations, always use the environment's Python:

```powershell
.venv\Scripts\python.exe detection.py
```

## 8. Controls

| Key | Action |
|---|---|
| `ESC` | Exit |
| `F` | Toggle fullscreen |
| `S` | Save screenshot + point cloud |

The application prints these controls when it starts. fileciteturn0file0L794-L797

## 9. Output Files

Press `S` to generate:

```text
scanner_YYYYMMDD_HHMMSS.jpg
scanner_YYYYMMDD_HHMMSS.ply
```

The `.jpg` contains the dashboard view and the `.ply` contains the sampled 3D point cloud. fileciteturn0file0L1041-L1050

## 10. Features

### RealSense Depth

The program collects depth points from the D435 and estimates:

- Scene width
- Scene height
- Median depth
- Passage width
- Passage height

Depth is limited to:

```text
0.3 m → 8.0 m
```

with an 8-pixel sampling step. fileciteturn0file0L40-L42

### Person Detection

YOLO detects people and displays:

```text
PERSON 1 92%
PERSON 2 87%
```

The person detector uses the YOLO model loaded from `yolo11n.pt`. fileciteturn0file0L665-L691

### Body-Part Measurements

The pose model measures depth for landmarks including:

- Nose
- Shoulders
- Elbows
- Wrists
- Hips
- Knees
- Ankles

fileciteturn0file0L54-L67

### Wi-Fi Node Detection

The application scans Windows Wi-Fi networks and only displays SSIDs matching:

```text
node*
```

For example:

```text
node01
node_rover
NODE_GATEWAY
```

fileciteturn0file0L28-L37

### Local Network Discovery

The application uses Windows networking commands to discover devices on the local subnet:

```text
ipconfig
ping
arp
```

LAN discovery is best-effort and may not detect every device. fileciteturn0file0L377-L380

### Voice Alerts

Windows PowerShell Speech is used for voice notifications. fileciteturn0file0L161-L182

## 11. Troubleshooting

### `ModuleNotFoundError: No module named 'cv2'`

Install OpenCV inside the **same Python environment** used to run the program:

```powershell
python -m pip install opencv-python
```

Verify:

```powershell
python -c "import cv2; print(cv2.__version__)"
```

### `No module named 'pyrealsense2'`

```powershell
python -m pip install pyrealsense2
```

Then verify:

```powershell
python -c "import pyrealsense2 as rs; print('RealSense OK')"
```

### Camera not detected

1. Connect the D435 directly to a USB 3.0 port.
2. Open RealSense Viewer.
3. Confirm color and depth streams work.
4. Close RealSense Viewer.
5. Run:

```powershell
python detection.py
```

### YOLO models missing

Make sure:

```text
yolo11n.pt
yolo11n-pose.pt
```

are beside `detection.py`.

If the models are missing, the application will continue without the corresponding YOLO features.

### Wi-Fi/LAN scanning does not work

The network scanner relies on Windows networking tools and WLAN APIs, so run the application on Windows with Wi-Fi enabled.

## 12. requirements.txt

Create `requirements.txt` with:

```text
opencv-python
numpy
pyrealsense2
ultralytics
```

Then installation becomes:

```powershell
python -m pip install -r requirements.txt
```

## 13. Quick Start

For a fresh Windows PC:

```powershell
git clone https://github.com/YOUR_USERNAME/RealSense_human_detection.git
cd RealSense_human_detection

py -3.11 -m venv .venv
.venv\Scripts\activate

python -m pip install --upgrade pip
pip install -r requirements.txt

python detection.py
```

Connect the **Intel RealSense D435**, put the YOLO model files beside `detection.py`, and you're ready to go. 🚀
