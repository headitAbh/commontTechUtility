# Aadhaar QR Decoder

A full-stack app to decode Aadhaar card QR codes using a React frontend and Flask backend.

## Project Structure

```
aadhaar-decoder/
  backend/       - Flask API (Python)
  frontend/      - React UI
```

## Setup & Run

### 1. Install pyaadhaar (one-time)

```bash
cd c:\Users\headit-pc\Downloads\pyaadhaar-main
pip install -e .
```

### 2. Start Backend

```bash
cd backend
pip install -r requirements.txt
python app.py
```

Backend runs at: http://localhost:5000

### 3. Start Frontend

```bash
cd frontend
npm install
npm start
```

Frontend runs at: http://localhost:3000

## Usage

1. Open http://localhost:3000
2. Upload an Aadhaar card image (JPG/PNG)
3. Click **Decode QR Code**
4. View extracted Aadhaar details
