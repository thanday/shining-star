const form = document.getElementById('uploadForm');
const progress = document.querySelector('.progress');
const bar = document.getElementById('progressBar');
const status = document.getElementById('status');
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Button glow cursor tracking
for (const btn of document.querySelectorAll('.btn')) {
  btn.addEventListener('pointermove', (e) => {
    const rect = btn.getBoundingClientRect();
    btn.style.setProperty('--x', `${e.clientX - rect.left}px`);
    btn.style.setProperty('--y', `${e.clientY - rect.top}px`);
  });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  status.textContent = '';
  bar.style.width = '0%';
  progress.style.display = 'block';

  const fd = new FormData(form);
  const file = fd.get('video');
  if (!file || !file.name) {
    status.textContent = 'Please choose a video file.';
    progress.style.display = 'none';
    return;
  }
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['mp4', 'mov'].includes(ext)) {
    status.textContent = 'Only MP4 or MOV files are allowed.';
    progress.style.display = 'none';
    return;
  }

  try {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/upload');

    xhr.upload.addEventListener('progress', (evt) => {
      if (evt.lengthComputable) {
        const pct = Math.round((evt.loaded / evt.total) * 100);
        bar.style.width = pct + '%';
      }
    });

    xhr.onreadystatechange = () => {
      if (xhr.readyState === XMLHttpRequest.DONE) {
        try {
          const res = JSON.parse(xhr.responseText || '{}');
          if (xhr.status >= 200 && xhr.status < 300 && res.ok) {
            status.textContent = `✅ Uploaded successfully as: ${res.filename}`;
            form.reset();
            bar.style.width = '0%';
          } else {
            throw new Error(res.error || 'Upload failed.');
          }
        } catch (err) {
          status.textContent = '❌ ' + (err.message || 'Upload failed.');
        } finally {
          setTimeout(() => { progress.style.display = 'none'; }, 500);
        }
      }
    };

    xhr.onerror = () => {
      status.textContent = '❌ Network error.';
      progress.style.display = 'none';
    };

    xhr.send(fd);
  } catch (err) {
    status.textContent = '❌ ' + err.message;
    progress.style.display = 'none';
  }
});