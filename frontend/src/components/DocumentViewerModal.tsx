import { useEffect, useState } from 'react';
import { X, Download, AlertTriangle, ExternalLink } from 'lucide-react';
import { fetchVersionFile, fileErrorMessage } from '../lib/files';

interface Props {
  versionId: string;
  fileName: string;
  onClose: () => void;
}

export default function DocumentViewerModal({ versionId, fileName, onClose }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('');
  const [error, setError] = useState('');

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setBlobUrl(null);
    setError('');
    fetchVersionFile(versionId)
      .then((blob) => {
        if (cancelled) return;
        setMimeType(blob.type || '');
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(async (err) => {
        if (!cancelled) setError(await fileErrorMessage(err));
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [versionId]);

  const lower = fileName.toLowerCase();
  const isPdf = mimeType.includes('pdf') || lower.endsWith('.pdf');
  const isImage = mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/.test(lower);

  return (
    <div className="fixed inset-0 bg-steel-950/70 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-steel-200">
          <span className="text-sm font-medium text-steel-900 truncate">{fileName}</span>
          <div className="flex items-center gap-3">
            {blobUrl && (
              <>
                <a
                  href={blobUrl}
                  target="_blank"
                  rel="noopener"
                  className="text-steel-500 hover:text-steel-900"
                  title="Abrir en una pestaña nueva"
                >
                  <ExternalLink size={17} />
                </a>
                <a href={blobUrl} download={fileName} className="text-steel-500 hover:text-steel-900" title="Descargar">
                  <Download size={17} />
                </a>
              </>
            )}
            <button onClick={onClose} className="text-steel-400 hover:text-steel-900">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-steel-50 flex items-center justify-center min-h-[300px]">
          {error && (
            <div className="flex flex-col items-center gap-2 text-steel-600 text-sm p-8 text-center max-w-lg">
              <AlertTriangle size={22} className="text-rojo-600" />
              {error}
            </div>
          )}
          {!error && !blobUrl && <p className="text-steel-400 text-sm">Cargando documento...</p>}
          {blobUrl && isPdf && <iframe src={blobUrl} title={fileName} className="w-full h-[80vh]" />}
          {blobUrl && isImage && (
            <img src={blobUrl} alt={fileName} className="max-w-full max-h-[80vh] object-contain" />
          )}
          {blobUrl && !isPdf && !isImage && (
            <div className="text-center text-steel-500 text-sm p-8">
              Vista previa no disponible para este tipo de archivo (Word, Excel, etc.).
              <br />
              <a href={blobUrl} download={fileName} className="inline-flex items-center gap-1.5 mt-3 font-semibold text-steel-900 underline">
                <Download size={15} /> Descargar {fileName}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
