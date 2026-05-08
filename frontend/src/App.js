import React, { useState, useRef, useEffect } from 'react';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || '';

const FIELD_LABELS = {
  name: 'Name',
  dob: 'Date of Birth',
  gender: 'Gender',
  careof: 'Care Of',
  house: 'House',
  street: 'Street',
  location: 'Location',
  landmark: 'Landmark',
  vtc: 'Village/Town/City',
  postoffice: 'Post Office',
  subdistrict: 'Sub District',
  district: 'District',
  state: 'State',
  pincode: 'Pincode',
  referenceid: 'Reference ID',
  aadhaar_last_4_digit: 'Aadhaar (Last 4 Digits)',
  email_mobile_status: 'Email/Mobile Status',
  email: 'Email Registered',
  mobile: 'Mobile Registered',
  uid: 'UID',
  yob: 'Year of Birth',
  gname: 'Guardian Name',
  lm: 'Landmark',
  loc: 'Locality',
  vtc_name: 'VTC',
  po: 'Post Office',
  dist: 'District',
  subdist: 'Sub District',
  last_4_digits_mobile_no: 'Last 4 Digits (Mobile)',
  version: 'QR Version',
};

const SKIP_FIELDS = ['email_mobile_status'];

function FieldValue({ value }) {
  if (typeof value === 'boolean') {
    return (
      <span className={`badge ${value ? 'badge-yes' : 'badge-no'}`}>
        {value ? 'Yes' : 'No'}
      </span>
    );
  }
  return <span>{String(value)}</span>;
}

function AadhaarResult({ result }) {
  const { qr_type, data, has_image, photo } = result;

  return (
    <div className="result-card">
      <div className="result-header">
        <h2>Decoded Successfully</h2>
        <span className="qr-type-badge">{qr_type}</span>
      </div>

      <div className="result-body">
        {has_image && photo && (
          <div className="photo-section">
            <img
              src={`data:image/jpeg;base64,${photo}`}
              alt="Aadhaar Photo"
              className="aadhaar-photo"
            />
          </div>
        )}

        <div className="fields-grid">
          {Object.entries(data)
            .filter(([key]) => !SKIP_FIELDS.includes(key))
            .map(([key, value]) => (
              <div className="field-row" key={key}>
                <span className="field-label">
                  {FIELD_LABELS[key] || key}
                </span>
                <span className="field-value">
                  <FieldValue value={value} />
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function CompressPdf() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // {original, compressed, savings, elapsed}
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('percent'); // 'percent' | 'size'
  const [quality, setQuality] = useState(60);
  const [targetMb, setTargetMb] = useState('');
  const [elapsed, setElapsed] = useState(0); // tenths of a second
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const inputRef = useRef();

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startTimer = () => {
    setElapsed(0);
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 100));
    }, 100);
  };

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    return startTimeRef.current ? (Date.now() - startTimeRef.current) : 0;
  };

  const fmtTime = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const fmt = (bytes) => {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / 1024).toFixed(1) + ' KB';
  };

  const handleFile = (selected) => {
    if (!selected) return;
    setFile(selected);
    setResult(null);
    setError(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  };

  const handleCompress = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    setError(null);
    startTimer();

    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('mode', mode);
    if (mode === 'percent') {
      formData.append('quality', quality);
    } else {
      if (!targetMb || isNaN(parseFloat(targetMb)) || parseFloat(targetMb) <= 0) {
        setError('Enter a valid target size in MB');
        stopTimer();
        setLoading(false);
        return;
      }
      formData.append('target_mb', targetMb);
    }

    try {
      const res = await fetch(`${API_URL}/api/compress-pdf`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || 'Compression failed');
        return;
      }

      const original = parseInt(res.headers.get('X-Original-Size') || '0');
      const compressed = parseInt(res.headers.get('X-Compressed-Size') || '0');
      const savings = parseFloat(res.headers.get('X-Savings-Percent') || '0');

      const blob = await res.blob();
      const elapsedMs = stopTimer();
      const baseName = file.name.replace(/\.pdf$/i, '');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseName}_compressed.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      setResult({ original, compressed, savings, elapsedMs });
    } catch {
      setError('Could not connect to server. Make sure the backend is running on port 5000.');
    } finally {
      stopTimer();
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    stopTimer();
    setElapsed(0);
  };

  return (
    <div className="upload-section">
      <div
        className={`drop-zone ${file ? 'has-file' : ''}`}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files[0])}
        />
        {file ? (
          <div className="drop-placeholder">
            <div className="upload-icon" style={{ color: '#e53e3e' }}>&#128196;</div>
            <p><strong>{file.name}</strong></p>
            <p className="hint">{fmt(file.size)}</p>
          </div>
        ) : (
          <div className="drop-placeholder">
            <div className="upload-icon">&#8679;</div>
            <p>Drag &amp; drop or <strong>click to upload</strong></p>
            <p className="hint">PDF files only</p>
          </div>
        )}
      </div>

      {file && (
        <div className="compress-options">
          <div className="compress-mode-toggle">
            <button
              className={`mode-btn${mode === 'percent' ? ' active' : ''}`}
              onClick={() => setMode('percent')}
            >By Quality %</button>
            <button
              className={`mode-btn${mode === 'size' ? ' active' : ''}`}
              onClick={() => setMode('size')}
            >By Target Size (MB)</button>
          </div>

          {mode === 'percent' && (
            <div className="compress-row">
              <label className="compress-label">Quality: <strong>{quality}%</strong></label>
              <input
                type="range"
                min="5"
                max="95"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="compress-slider"
              />
              <div className="compress-hints">
                <span>Smaller file</span><span>Better quality</span>
              </div>
            </div>
          )}

          {mode === 'size' && (
            <div className="compress-row">
              <label className="compress-label">Target size (MB)</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                placeholder="e.g. 1.5"
                value={targetMb}
                onChange={(e) => setTargetMb(e.target.value)}
                className="compress-mb-input"
              />
            </div>
          )}
        </div>
      )}

      {error && <div className="error-box">{error}</div>}

      {loading && (
        <div className="compress-timer">
          <span className="timer-spinner">&#9696;</span>
          Compressing&hellip; <strong>{(elapsed / 10).toFixed(1)}s</strong>
        </div>
      )}

      {result && (
        <div className="compress-result">
          <div className="compress-stat">
            <span>Original</span><strong>{fmt(result.original)}</strong>
          </div>
          <div className="compress-arrow">&#8594;</div>
          <div className="compress-stat">
            <span>Compressed</span><strong>{fmt(result.compressed)}</strong>
          </div>
          <div className="compress-badge">&#8595; {result.savings}% saved</div>
          <div className="compress-time-badge">&#128336; {fmtTime(result.elapsedMs)}</div>
        </div>
      )}

      <div className="action-buttons">
        <button
          className="btn btn-primary"
          onClick={handleCompress}
          disabled={!file || loading}
        >
          {loading ? (
            <>{`Compressing... ${(elapsed / 10).toFixed(1)}s`}</>
          ) : 'Compress PDF'}
        </button>
        {file && (
          <button className="btn btn-secondary" onClick={handleReset}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

function PdfToExcel() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef();

  const handleFile = (selected) => {
    if (!selected) return;
    setFile(selected);
    setDone(false);
    setError(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  };

  const handleConvert = async () => {
    if (!file) return;
    setLoading(true);
    setDone(false);
    setError(null);

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const res = await fetch(`${API_URL}/api/pdf-to-excel`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || 'Conversion failed');
        return;
      }

      const blob = await res.blob();
      const baseName = file.name.replace(/\.pdf$/i, '');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseName}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      setDone(true);
    } catch {
      setError('Could not connect to server. Make sure the backend is running on port 5000.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setDone(false);
    setError(null);
  };

  return (
    <div className="upload-section">
      <div
        className={`drop-zone ${file ? 'has-file' : ''}`}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files[0])}
        />
        {file ? (
          <div className="drop-placeholder">
            <div className="upload-icon" style={{ color: '#e53e3e' }}>&#128196;</div>
            <p><strong>{file.name}</strong></p>
          </div>
        ) : (
          <div className="drop-placeholder">
            <div className="upload-icon">&#8679;</div>
            <p>Drag &amp; drop or <strong>click to upload</strong></p>
            <p className="hint">PDF files only — tables &amp; text extracted per page</p>
          </div>
        )}
      </div>

      {error && <div className="error-box">{error}</div>}

      {done && (
        <div className="success-box">&#9989; Converted successfully &mdash; your download has started.</div>
      )}

      <div className="action-buttons">
        <button
          className="btn btn-primary"
          onClick={handleConvert}
          disabled={!file || loading}
        >
          {loading ? 'Converting...' : 'Convert to Excel'}
        </button>
        {file && (
          <button className="btn btn-secondary" onClick={handleReset}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

function PdfToWord() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef();

  const handleFile = (selected) => {
    if (!selected) return;
    setFile(selected);
    setDone(false);
    setError(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  };

  const handleConvert = async () => {
    if (!file) return;
    setLoading(true);
    setDone(false);
    setError(null);

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const res = await fetch(`${API_URL}/api/pdf-to-word`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || 'Conversion failed');
        return;
      }

      const blob = await res.blob();
      const baseName = file.name.replace(/\.pdf$/i, '');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseName}.docx`;
      link.click();
      URL.revokeObjectURL(url);
      setDone(true);
    } catch {
      setError('Could not connect to server. Make sure the backend is running on port 5000.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setDone(false);
    setError(null);
  };

  return (
    <div className="upload-section">
      <div
        className={`drop-zone ${file ? 'has-file' : ''}`}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files[0])}
        />
        {file ? (
          <div className="drop-placeholder">
            <div className="upload-icon" style={{ color: '#e53e3e' }}>&#128196;</div>
            <p><strong>{file.name}</strong></p>
          </div>
        ) : (
          <div className="drop-placeholder">
            <div className="upload-icon">&#8679;</div>
            <p>Drag &amp; drop or <strong>click to upload</strong></p>
            <p className="hint">PDF files only</p>
          </div>
        )}
      </div>

      {error && <div className="error-box">{error}</div>}

      {done && (
        <div className="success-box">&#9989; Converted successfully &mdash; your download has started.</div>
      )}

      <div className="action-buttons">
        <button
          className="btn btn-primary"
          onClick={handleConvert}
          disabled={!file || loading}
        >
          {loading ? 'Converting...' : 'Convert to Word'}
        </button>
        {file && (
          <button className="btn btn-secondary" onClick={handleReset}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

function PdfConverter() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pages, setPages] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef();

  const handleFile = (selected) => {
    if (!selected) return;
    setFile(selected);
    setPages(null);
    setError(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  };

  const handleConvert = async () => {
    if (!file) return;
    setLoading(true);
    setPages(null);
    setError(null);

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const res = await fetch(`${API_URL}/api/pdf-to-jpg`, {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error || 'Something went wrong');
      } else {
        setPages(json.pages);
      }
    } catch {
      setError('Could not connect to server. Make sure the backend is running on port 5000.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (page) => {
    const link = document.createElement('a');
    link.href = `data:image/jpeg;base64,${page.image}`;
    const baseName = file ? file.name.replace(/\.pdf$/i, '') : 'document';
    link.download = `${baseName}-page-${page.page}.jpg`;
    link.click();
  };

  const handleDownloadAll = () => {
    if (!pages) return;
    pages.forEach((page, i) => {
      setTimeout(() => handleDownload(page), i * 150);
    });
  };

  const handleReset = () => {
    setFile(null);
    setPages(null);
    setError(null);
  };

  return (
    <div className="upload-section">
      <div
        className={`drop-zone ${file ? 'has-file' : ''}`}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files[0])}
        />
        {file ? (
          <div className="drop-placeholder">
            <div className="upload-icon" style={{ color: '#e53e3e' }}>&#128196;</div>
            <p><strong>{file.name}</strong></p>
          </div>
        ) : (
          <div className="drop-placeholder">
            <div className="upload-icon">&#8679;</div>
            <p>Drag &amp; drop or <strong>click to upload</strong></p>
            <p className="hint">PDF files only</p>
          </div>
        )}
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className="action-buttons">
        <button
          className="btn btn-primary"
          onClick={handleConvert}
          disabled={!file || loading}
        >
          {loading ? 'Converting...' : 'Convert to JPG'}
        </button>
        {file && (
          <button className="btn btn-secondary" onClick={handleReset}>
            Clear
          </button>
        )}
      </div>

      {pages && (
        <div className="pdf-pages">
          <div className="pdf-pages-header">
            <h3 className="pdf-pages-title">
              {pages.length} page{pages.length !== 1 ? 's' : ''} converted
            </h3>
            <button className="btn btn-primary" onClick={handleDownloadAll}>
              &#8595; Download All ({pages.length})
            </button>
          </div>
          <div className="pdf-pages-grid">
            {pages.map((page) => (
              <div className="pdf-page-card" key={page.page}>
                <img
                  src={`data:image/jpeg;base64,${page.image}`}
                  alt={`Page ${page.page}`}
                  className="pdf-page-img"
                />
                <button
                  className="btn btn-secondary pdf-download-btn"
                  onClick={() => handleDownload(page)}
                >
                  &#8595; Page {page.page}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function QrCodeGenerator() {
  const [url, setUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    const trimmed = url.trim();
    if (!trimmed) { setError('Please enter a URL or text'); return; }
    setLoading(true);
    setError(null);
    setQrDataUrl(null);
    try {
      const QRCode = (await import('qrcode')).default;
      const dataUrl = await QRCode.toDataURL(trimmed, { width: 512, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });
      setQrDataUrl(dataUrl);
    } catch {
      setError('Failed to generate QR code.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = 'qrcode.png';
    link.click();
  };

  const handleShare = async () => {
    if (navigator.share && navigator.canShare) {
      try {
        const res = await fetch(qrDataUrl);
        const blob = await res.blob();
        const file = new File([blob], 'qrcode.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'QR Code', text: url });
          return;
        }
      } catch { /* fall through to clipboard */ }
    }
    // Fallback: copy original URL to clipboard
    try {
      await navigator.clipboard.writeText(url.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Share not supported on this browser.');
    }
  };

  const handleReset = () => {
    setUrl('');
    setQrDataUrl(null);
    setError(null);
    setCopied(false);
  };

  return (
    <div className="upload-section">
      <div className="qrgen-input-row">
        <input
          type="text"
          className="qrgen-url-input"
          placeholder="Enter URL or any text..."
          value={url}
          onChange={(e) => { setUrl(e.target.value); setQrDataUrl(null); setError(null); }}
          onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
        />
        <button
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={!url.trim() || loading}
        >
          {loading ? 'Generating...' : 'Generate QR'}
        </button>
      </div>

      {error && <div className="error-box">{error}</div>}

      {qrDataUrl && (
        <div className="qrgen-result">
          <div className="qrgen-image-wrap">
            <img src={qrDataUrl} alt="Generated QR Code" className="qrgen-image" />
          </div>
          <p className="qrgen-url-display">{url}</p>
          <div className="action-buttons center">
            <button className="btn btn-primary" onClick={handleDownload}>
              &#8595; Download PNG
            </button>
            <button className="btn btn-secondary" onClick={handleShare}>
              {copied ? <>&#10003; URL Copied!</> : <>&#8679; Share</>}
            </button>
            <button className="btn btn-secondary" onClick={handleReset}>
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState('qr');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [cropSel, setCropSel] = useState(null);   // {x1,y1,x2,y2} in canvas px
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const inputRef = useRef();
  const imgRef = useRef();
  const canvasRef = useRef();

  // Redraw selection overlay whenever cropSel changes
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!cropSel) return;
    const x = Math.min(cropSel.x1, cropSel.x2);
    const y = Math.min(cropSel.y1, cropSel.y2);
    const w = Math.abs(cropSel.x2 - cropSel.x1);
    const h = Math.abs(cropSel.y2 - cropSel.y1);
    // dim outside selection
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.clearRect(x, y, w, h);
    // border
    ctx.strokeStyle = '#f6ad55';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    // corner handles
    const hs = 8;
    ctx.fillStyle = '#f6ad55';
    [[x,y],[x+w,y],[x,y+h],[x+w,y+h]].forEach(([cx,cy]) => {
      ctx.fillRect(cx - hs/2, cy - hs/2, hs, hs);
    });
  }, [cropSel]);

  const getRelPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = (e) => {
    e.stopPropagation();
    const pos = getRelPos(e);
    setDragStart(pos);
    setIsDragging(true);
    setCropSel({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const pos = getRelPos(e);
    setCropSel(prev => prev ? { ...prev, x2: pos.x, y2: pos.y } : null);
  };

  const handleMouseUp = (e) => {
    if (!isDragging) return;
    setIsDragging(false);
    setDragStart(null);
    setCropSel(prev => {
      if (!prev) return null;
      const w = Math.abs(prev.x2 - prev.x1);
      const h = Math.abs(prev.y2 - prev.y1);
      return (w < 10 || h < 10) ? null : prev;
    });
  };

  const handleFile = (selected) => {
    if (!selected) return;
    setFile(selected);
    setResult(null);
    setError(null);
    setCropSel(null);
    setPreview(URL.createObjectURL(selected));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    setError(null);

    let imageBlob = file;

    if (cropSel && imgRef.current) {
      const img = imgRef.current;
      const scaleX = img.naturalWidth / img.clientWidth;
      const scaleY = img.naturalHeight / img.clientHeight;
      const x = Math.round(Math.min(cropSel.x1, cropSel.x2) * scaleX);
      const y = Math.round(Math.min(cropSel.y1, cropSel.y2) * scaleY);
      const w = Math.round(Math.abs(cropSel.x2 - cropSel.x1) * scaleX);
      const h = Math.round(Math.abs(cropSel.y2 - cropSel.y1) * scaleY);
      const offscreen = document.createElement('canvas');
      offscreen.width = w;
      offscreen.height = h;
      offscreen.getContext('2d').drawImage(img, x, y, w, h, 0, 0, w, h);
      imageBlob = await new Promise(resolve => offscreen.toBlob(resolve, 'image/jpeg', 0.95));
    }

    const formData = new FormData();
    formData.append('image', imageBlob, 'image.jpg');

    try {
      const res = await fetch(`${API_URL}/api/decode`, {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error || 'Something went wrong');
      } else {
        setResult(json);
      }
    } catch {
      setError('Could not connect to server. Make sure the backend is running on port 5000.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setCropSel(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="logo">&#9632;</div>
          <div className='container-fluid'>
            <h1>Adhar QrCode Decoder and  Converters PDF TO JPG, WORD AND EXCEL, Generate QrCode</h1>
            {/* <p>Upload a PDF file to convert it to JPG, Word, or Excel formats</p> */}
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="tab-bar">
          <button
            className={`tab-btn${mode === 'qr' ? ' active' : ''}`}
            onClick={() => setMode('qr')}
          >
            QR Decoder(Aadhar Only)
          </button>
          <button
            className={`tab-btn${mode === 'pdf' ? ' active' : ''}`}
            onClick={() => setMode('pdf')}
          >
            PDF to JPG
          </button>
          <button
            className={`tab-btn${mode === 'word' ? ' active' : ''}`}
            onClick={() => setMode('word')}
          >
            PDF to Word
          </button>
          <button
            className={`tab-btn${mode === 'excel' ? ' active' : ''}`}
            onClick={() => setMode('excel')}
          >
            PDF to Excel
          </button>
          <button
            className={`tab-btn${mode === 'compress' ? ' active' : ''}`}
            onClick={() => setMode('compress')}
          >
            Compress PDF
          </button>
          <button
            className={`tab-btn${mode === 'qrgen' ? ' active' : ''}`}
            onClick={() => setMode('qrgen')}
          >
            QR Code Generator
          </button>
        </div>

        {mode === 'pdf' && <PdfConverter />}
        {mode === 'word' && <PdfToWord />}
        {mode === 'excel' && <PdfToExcel />}
        {mode === 'compress' && <CompressPdf />}
        {mode === 'qrgen' && <QrCodeGenerator />}

        {mode === 'qr' && !result && (
          <div className="upload-section">
            <div
              className={`drop-zone ${file ? 'has-file' : ''}`}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => { if (!preview) inputRef.current.click(); }}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => handleFile(e.target.files[0])}
              />
              {preview ? (
                <div
                  className="crop-container"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <img
                    ref={imgRef}
                    src={preview}
                    alt="Preview"
                    className="preview-img"
                    draggable={false}
                  />
                  <canvas ref={canvasRef} className="crop-canvas" />
                </div>
              ) : (
                <div className="drop-placeholder">
                  <div className="upload-icon">&#8679;</div>
                  <p>Drag &amp; drop or <strong>click to upload</strong></p>
                  <p className="hint">Supports JPG, PNG, JPEG, BMP, WEBP</p>
                </div>
              )}
            </div>

            {file && !cropSel && (
              <p className="filename crop-hint">&#9654; Drag on the image to select the QR code area, or decode the full image</p>
            )}
            {cropSel && (
              <p className="filename crop-hint active-crop">&#9989; QR area selected &mdash; <button className="link-btn" onClick={(e) => { e.stopPropagation(); setCropSel(null); }}>Clear selection</button></p>
            )}

            {error && (
              <div className="error-box">{error}</div>
            )}

            <div className="action-buttons">
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={!file || loading}
              >
                {loading ? 'Decoding...' : cropSel ? 'Decode Selected Area' : 'Decode QR Code'}
              </button>
              {file && (
                <button className="btn btn-secondary" onClick={handleReset}>
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {mode === 'qr' && result && (
          <div>
            <AadhaarResult result={result} />
            <div className="action-buttons center">
              <button className="btn btn-secondary" onClick={handleReset}>
                Decode Another
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <span className="footer-logo">&#9632;</span>
            <div>
              <div className="footer-company">DKG DevOps Tech by <strong>Ganotras</strong></div>
            </div>
          </div>

          <div className="footer-links">
            <a href="mailto:support@ganotras.in" className="footer-link">&#9993; support@ganotras.in</a>
            <span className="footer-sep">|</span>
            <a href="tel:+91-978-143-1060" className="footer-link">&#128222; +91 978 143 1060</a>
            <span className="footer-sep">|</span>
            <a href="https://www.ganotras.in" target="_blank" rel="noopener noreferrer" className="footer-link">&#127760; ganotras.in</a>
          </div>

          <div className="footer-meta">
            <span>&#128274; Data is processed securely and never stored.</span>
            <span className="footer-sep">|</span>
            <span>&#169; {new Date().getFullYear()} Ganotras. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
