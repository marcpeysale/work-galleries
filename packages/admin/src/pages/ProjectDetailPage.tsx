import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Trash2, ImageIcon, Video } from 'lucide-react';
import { api } from '../lib/api';
import { Select } from '../components/ui/Select';
import type { Project, Media } from '@gallery/shared';
import { PROJECT_STATUS_LABELS } from '@gallery/shared';

const STATUS_OPTIONS = Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => ({ value, label }));

export const ProjectDetailPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [status, setStatus] = useState<Project['status']>('created');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    if (!projectId) return;
    const [p, m] = await Promise.all([
      api.get<Project>(`/admin/projects/${projectId}`),
      api.get<Media[]>(`/gallery/projects/${projectId}/media`),
    ]);
    setProject(p);
    setStatus(p.status);
    setMedia(m);
  };

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [projectId]);

  const handleStatusChange = async (newStatus: string) => {
    if (!projectId) return;
    setStatus(newStatus as Project['status']);
    await api.put(`/admin/projects/${projectId}`, { status: newStatus });
    await fetchData();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !projectId) return;
    setUploading(true);
    try {
      for (const file of files) {
        const isVideo = file.type.startsWith('video/');
        const { uploadUrl } = await api.post<{ uploadUrl: string; mediaId: string }>(`/admin/projects/${projectId}/media/upload-url`, {
          filename: file.name,
          type: isVideo ? 'video' : 'photo',
          contentType: file.type,
        });
        await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      }
      await fetchData();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (mediaId: string) => {
    if (!projectId) return;
    setDeletingId(mediaId);
    try {
      await api.delete(`/admin/projects/${projectId}/media/${mediaId}`);
      setMedia((prev) => prev.filter((m) => m.id !== mediaId));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div className="p-8 text-muted">Chargement…</div>;
  if (!project) return <div className="p-8 text-muted">Projet introuvable.</div>;

  const photos = media.filter((m) => m.type === 'photo');
  const videos = media.filter((m) => m.type === 'video');

  return (
    <div className="p-8 max-w-wrap mx-auto">
      <button onClick={() => navigate('/projects')} className="flex items-center gap-2 text-xs text-muted hover:text-text-primary transition-colors mb-8 uppercase tracking-widest">
        <ArrowLeft size={14} /> Retour
      </button>

      <div className="flex items-start justify-between mb-10 gap-4">
        <div>
          <p className="text-xs text-accent font-semibold tracking-widest uppercase mb-2">Projet</p>
          <h1 className="font-display text-4xl tracking-wider">{project.name}</h1>
          <p className="text-muted text-sm mt-2">
            {project.clientInfo.firstName} {project.clientInfo.lastName} — {String(project.month).padStart(2, '0')}/{project.year}
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <Select
            label="Statut"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="min-w-[180px]"
          />
          <div className="pt-6">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
              aria-label="Téléverser des médias"
            />
            <label
              htmlFor="file-upload"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
              className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold tracking-widest uppercase transition-colors cursor-pointer bg-accent hover:bg-accent-hover text-white ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
            >
              {uploading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />}
              <Upload size={14} aria-hidden="true" />
              {uploading ? 'Upload…' : 'Ajouter des médias'}
            </label>
          </div>
        </div>
      </div>

      {media.length === 0 ? (
        <div className="bg-surface border border-dashed border-border flex flex-col items-center justify-center py-20 text-center">
          <ImageIcon size={32} className="text-faint mb-4" aria-hidden="true" />
          <p className="text-muted text-sm">Aucun média dans ce projet.</p>
          <p className="text-faint text-xs mt-1">Utilisez le bouton "Ajouter des médias" pour commencer.</p>
        </div>
      ) : (
        <>
          {photos.length > 0 && (
            <MediaSection title="Photos" icon={ImageIcon} items={photos} deletingId={deletingId} onDelete={handleDelete} />
          )}
          {videos.length > 0 && (
            <MediaSection title="Vidéos" icon={Video} items={videos} deletingId={deletingId} onDelete={handleDelete} />
          )}
        </>
      )}
    </div>
  );
};

const MediaSection = ({
  title,
  icon: Icon,
  items,
  deletingId,
  onDelete,
}: {
  title: string;
  icon: typeof ImageIcon;
  items: Media[];
  deletingId: string | null;
  onDelete: (id: string) => void;
}) => (
  <div className="mb-10">
    <div className="flex items-center gap-2 mb-4">
      <Icon size={15} className="text-muted" aria-hidden="true" />
      <h2 className="font-display text-xl tracking-wider">{title}</h2>
      <span className="text-xs text-faint ml-1">({items.length})</span>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {items.map((item) => (
        <div key={item.id} className="relative group aspect-square bg-elevated overflow-hidden">
          {item.type === 'photo' ? (
            <img
              src={item.url}
              alt={item.filename}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <video
              src={item.url}
              className="w-full h-full object-cover"
              preload="metadata"
            />
          )}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <button
              onClick={() => onDelete(item.id)}
              disabled={deletingId === item.id}
              aria-label={`Supprimer ${item.filename}`}
              className="p-2 text-white hover:text-red-400 transition-colors disabled:opacity-50"
            >
              <Trash2 size={18} />
            </button>
          </div>
          <p className="absolute bottom-0 inset-x-0 bg-black/70 px-2 py-1 text-xs text-muted truncate opacity-0 group-hover:opacity-100 transition-opacity">
            {item.filename}
          </p>
        </div>
      ))}
    </div>
  </div>
);
