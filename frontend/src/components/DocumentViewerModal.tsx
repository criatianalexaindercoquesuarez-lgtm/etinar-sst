import { useEffect, useState } from 'react';
import { X, Download, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';

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
    api
      .get(`/documents/version/${versionId}/file`, { responseType: 'blob' })
      .then((res) => {
        const type = res.headers['content-type'] || res.data.type;
        setMimeType(type);
        objectUrl = URL.createObjectURL(res.data);
        setBlobUrl(objectUrl);
      })
      .catch(() => setError('No se pudo cargar el documento (verifica permisos o que el archivo exista).'));

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [versionId]);

  const isPdf = mimeType.includes('pdf');
  const isImage = mimeType.startsWith('image/');

  return (
    <div className="fixed inset-0 bg-steel-950/70 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-steel-200">
          <span className="text-sm font-medium text-steel-900 truncate">{fileName}</span>
          <div className="flex items-center gap-3">
            {blobUrl && (
              <a
                href={blobUrl}
                download={fileName}
                className="text-steel-500 hover:text-steel-900"
                title="Descargar"
              >
                <Download size={17} />
              </a>
            )}
            <button onClick={onClose} className="text-steel-400 hover:text-steel-900">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-steel-50 flex items-center justify-center min-h-[300px]">
          {error && (
            <div className="flex flex-col items-center gap-2 text-steel-500 text-sm p-8 text-center">
              <AlertTriangle size={22} />
              {error}
            </div>
          )}
          {!error && !blobUrl && <p className="text-steel-400 text-sm">Cargando documento...</p>}
          {blobUrl && isPdf && (
            <iframe src={blobUrl} title={fileName} className="w-full h-[70vh]" />
          )}
          {blobUrl && isImage && (
            <img src={blobUrl} alt={fileName} className="max-w-full max-h-[70vh] object-contain" />
          )}
          {blobUrl && !isPdf && !isImage && (
            <div className="text-center text-steel-500 text-sm p-8">
              Vista previa no disponible para este tipo de archivo.
              <br />
              Usa el botón de descarga para abrirlo.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
