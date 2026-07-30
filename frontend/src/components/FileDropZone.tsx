import { useEffect, useRef, useState, type DragEvent } from 'react';
import { UploadCloud, FileText, X } from 'lucide-react';

interface Props {
  file: File | null;
  onChange: (file: File | null) => void;
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
];

export default function FileDropZone({ file, onChange }: Props) {
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    if (ACCEPTED_TYPES.includes(file.type)) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [file]);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onChange(dropped);
  }

  if (file) {
    return (
      <div className="border border-steel-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-steel-50 border-b border-steel-200">
          <span className="text-xs text-steel-600 truncate flex items-center gap-1.5">
            <FileText size={13} /> {file.name}
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-steel-400 hover:text-rojo-600"
          >
            <X size={15} />
          </button>
        </div>

        {previewUrl && file.type === 'application/pdf' && (
          <iframe src={previewUrl} title="Vista previa PDF" className="w-full h-64" />
        )}
        {previewUrl && file.type.startsWith('image/') && (
          <img src={previewUrl} alt="Vista previa" className="w-full max-h-64 object-contain bg-steel-50" />
        )}
        {!previewUrl && (
          <div className="p-4 text-xs text-steel-400 text-center">
            Sin vista previa disponible para este tipo de archivo.
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg py-8 px-4 text-center cursor-pointer transition-colors ${
        dragging ? 'border-safety-500 bg-safety-100' : 'border-steel-300 hover:border-steel-400'
      }`}
    >
      <UploadCloud size={26} className={dragging ? 'text-safety-500' : 'text-steel-400'} />
      <p className="text-sm text-steel-600">
        Arrastra el archivo aquí, o haz clic para seleccionar
      </p>
      <p className="text-xs text-steel-400">PDF, JPG, PNG o WEBP · máx. 20MB</p>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
