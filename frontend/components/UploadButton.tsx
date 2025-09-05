// frontend/components/UploadButton.tsx
'use client';
import React, { useState } from 'react';

type Props = { onDone?: () => void };

export default function UploadButton({ onDone }: Props) {
  const [files, setFiles] = useState<FileList | null>(null);
  const [tagText, setTagText] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const maxFiles = 5;

  function addTag() {
    const t = tagText.trim();
    if (t && !tags.includes(t)) {
      setTags((prev) => [...prev, t]);
      setTagText('');
    }
  }

  function removeTag(idx: number) {
    setTags((prev) => prev.filter((_, i) => i !== idx));
  }

  function onFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFiles(e.target.files);
  }

  async function upload() {
    if (!files || files.length === 0) return;
    const fd = new FormData();
    for (let i = 0; i < files.length && i < maxFiles; i++) {
      fd.append('files', files[i]);
    }
    fd.append('tags', JSON.stringify(tags));

    setUploading(true);
    setProgress(0);

    // Use XHR to show upload progress easily
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/ingest');
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable)
          setProgress(Math.round((evt.loaded / evt.total) * 100));
      };
      xhr.onload = () => {
        setUploading(false);
        if (xhr.status >= 200 && xhr.status < 300) {
          setFiles(null);
          setTags([]);
          setProgress(0);
          onDone && onDone();
          resolve();
        } else {
          reject(new Error(`upload failed ${xhr.status}`));
        }
      };
      xhr.onerror = () => {
        setUploading(false);
        reject(new Error('network error'));
      };
      xhr.send(fd);
    }).catch((err) => {
      alert('Upload failed: ' + (err as Error).message);
    });
  }

  return (
    <div className="upload-block">
      <label className="file-field">
        <input
          type="file"
          multiple
          accept="application/pdf"
          onChange={onFilesChange}
        />
        <span>Attach PDF(s)</span>
      </label>

      <div className="tags-row">
        <input
          placeholder="Add tag and press Enter (eg: finance, hr)"
          value={tagText}
          onChange={(e) => setTagText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag();
            }
          }}
        />
        <button onClick={addTag} type="button">
          Add
        </button>
      </div>

      <div className="tag-list">
        {tags.map((t, i) => (
          <span key={t} className="tag">
            {t}{' '}
            <button onClick={() => removeTag(i)} aria-label={`Remove ${t}`}>
              ×
            </button>
          </span>
        ))}
      </div>

      <div className="upload-actions">
        <button
          onClick={upload}
          disabled={uploading || !files || files.length === 0}
        >
          {uploading ? `Uploading... (${progress}%)` : 'Upload & Ingest'}
        </button>
      </div>

      {uploading && (
        <div className="progress">
          <div className="progress-inner" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
