/* ============================================================
   Media Downloader — CEP Panel Logic
   Handles UI, download via downloader.exe, AE integration
   ============================================================ */

const path = require('path');
const { spawn } = require('child_process');

// Initialize CSInterface
const csInterface = new CSInterface();

// ── DOM References ──────────────────────────────────────────
const downloadBtn      = document.getElementById('download-btn');
const urlInput         = document.getElementById('url-input');
const formatSelect     = document.getElementById('format-select');
const qualitySelect    = document.getElementById('quality-select');
const qualityContainer = document.getElementById('quality-container');
const message          = document.getElementById('message');
const progressBar      = document.getElementById('progress-bar');
const progressContainer= document.getElementById('progress-bar-container');
const btnContent       = downloadBtn.querySelector('.btn-content');
const btnSpinner       = downloadBtn.querySelector('.btn-spinner');

// ── State ───────────────────────────────────────────────────
let isDownloading = false;

// ── Format Toggle ───────────────────────────────────────────
formatSelect.addEventListener('change', () => {
    if (formatSelect.value === 'mp4') {
        qualityContainer.classList.remove('hidden');
        qualityContainer.classList.add('visible');
    } else {
        qualityContainer.classList.remove('visible');
        qualityContainer.classList.add('hidden');
    }
});

// Initialize quality visibility
qualityContainer.classList.add('visible');

// ── Download Button Click ───────────────────────────────────
downloadBtn.addEventListener('click', () => {
    if (isDownloading) return;

    const url = urlInput.value.trim();
    if (!url) {
        showMessage('Please paste a valid URL', 'error');
        shakeInput();
        return;
    }

    // Validate URL loosely
    if (!isValidURL(url)) {
        showMessage('Invalid URL format', 'error');
        shakeInput();
        return;
    }

    // Get project path from After Effects
    csInterface.evalScript('getProjectPath()', (projectPath) => {
        if (!projectPath || projectPath === 'null' || projectPath === 'EvalScript error.' || projectPath === '') {
            showMessage('Save your AE project first!', 'error');
            return;
        }
        startDownload(url, projectPath);
    });
});

// Allow Enter key to trigger download
urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        downloadBtn.click();
    }
});

// ── Download Process ────────────────────────────────────────
function startDownload(url, outputDir) {
    isDownloading = true;
    setLoadingState(true);
    showMessage('Initializing download...', 'info');
    showProgress(true);
    setProgress(0);

    // Resolve path to downloader.exe in the bin/ folder
    const extensionPath = csInterface.getSystemPath(SystemPath.EXTENSION);
    const exePath = path.join(extensionPath, 'bin', 'downloader.exe');

    const args = [
        '--url', url,
        '--mode', formatSelect.value,
        '--quality', qualitySelect.value,
        '--out', outputDir
    ];

    let hasResult = false;

    const proc = spawn(exePath, args);

    proc.stdout.on('data', (data) => {
        const output = data.toString();
        const lines = output.split('\n');

        lines.forEach((line) => {
            line = line.trim();
            if (!line) return;

            if (line.startsWith('PROGRESS:')) {
                const percent = parseFloat(line.split('PROGRESS:')[1]);
                if (!isNaN(percent)) {
                    setProgress(Math.min(percent, 100));
                    showMessage(`Downloading: ${Math.round(percent)}%`, 'info');
                }
            }

            if (line.startsWith('SUCCESS:')) {
                hasResult = true;
                const filePath = line.substring('SUCCESS:'.length).trim();
                setProgress(100);
                showMessage('Importing into After Effects...', 'info');
                importToAE(filePath);
            }

            if (line.startsWith('ERROR:')) {
                hasResult = true;
                const errorMsg = line.substring('ERROR:'.length).trim();
                handleError(errorMsg);
            }
        });
    });

    proc.stderr.on('data', (data) => {
        // yt-dlp writes progress to stderr too, we can ignore most of it
        const output = data.toString();
        if (output.includes('ERROR')) {
            console.error('[Downloader STDERR]', output);
        }
    });

    proc.on('error', (err) => {
        handleError('Failed to start downloader: ' + err.message);
    });

    proc.on('close', (code) => {
        if (!hasResult && code !== 0) {
            handleError('Download process exited with error (code ' + code + ')');
        }
    });
}

// ── After Effects Import ────────────────────────────────────
function importToAE(filePath) {
    // Escape backslashes for ExtendScript string
    const safePath = filePath.replace(/\\/g, '/');
    
    csInterface.evalScript(`importMedia("${safePath}")`, (result) => {
        if (result && result.indexOf('Error') !== -1) {
            handleError('Import failed: ' + result);
            return;
        }

        showMessage('Downloaded & added to composition ✓', 'success');
        finishDownload();
    });
}

// ── UI Helpers ──────────────────────────────────────────────

function setLoadingState(loading) {
    downloadBtn.disabled = loading;
    if (loading) {
        btnContent.style.display = 'none';
        btnSpinner.style.display = 'flex';
    } else {
        btnContent.style.display = 'flex';
        btnSpinner.style.display = 'none';
    }
}

function showMessage(text, type) {
    message.textContent = text;
    message.className = ''; // reset
    if (type) message.classList.add(type);
    // Trigger fade-in animation
    message.classList.remove('fade-in');
    void message.offsetWidth; // reflow trick
    message.classList.add('fade-in');
}

function showProgress(visible) {
    progressContainer.style.display = visible ? 'block' : 'none';
}

function setProgress(percent) {
    progressBar.style.width = percent + '%';
    // Reset error-style if it was set
    progressBar.style.background = '';
}

function shakeInput() {
    urlInput.style.animation = 'none';
    void urlInput.offsetWidth;
    urlInput.style.animation = 'shake 0.4s ease';
    setTimeout(() => { urlInput.style.animation = ''; }, 400);
}

function handleError(errorMsg) {
    showMessage(errorMsg, 'error');
    progressBar.style.background = 'var(--error)';
    finishDownload(false);
}

function finishDownload(clearInput = true) {
    isDownloading = false;
    setLoadingState(false);

    if (clearInput) {
        urlInput.value = '';
    }

    // Hide progress after delay
    setTimeout(() => {
        showProgress(false);
        setProgress(0);
    }, 3500);

    // Clear message after delay
    setTimeout(() => {
        if (!isDownloading) {
            message.textContent = '';
            message.className = '';
        }
    }, 5000);
}

function isValidURL(str) {
    try {
        const url = new URL(str);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

// ── Drag & Drop Support ─────────────────────────────────────
(function initDragDrop() {
    // Create overlay element
    const overlay = document.createElement('div');
    overlay.className = 'drag-overlay';
    overlay.innerHTML = '<span class="drag-overlay-text">Drop URL here</span>';
    document.body.appendChild(overlay);

    let dragCounter = 0;

    document.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragCounter++;
        overlay.classList.add('active');
    });

    document.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter <= 0) {
            dragCounter = 0;
            overlay.classList.remove('active');
        }
    });

    document.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    document.addEventListener('drop', (e) => {
        e.preventDefault();
        dragCounter = 0;
        overlay.classList.remove('active');

        const text = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list');
        if (text && isValidURL(text.trim())) {
            urlInput.value = text.trim();
            urlInput.focus();
            showMessage('URL pasted — ready to download', 'info');
        }
    });
})();

// ── Inject shake keyframes (CSS-in-JS for animation) ────────
(function injectShakeAnimation() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-6px); }
            40% { transform: translateX(5px); }
            60% { transform: translateX(-4px); }
            80% { transform: translateX(3px); }
        }
    `;
    document.head.appendChild(style);
})();