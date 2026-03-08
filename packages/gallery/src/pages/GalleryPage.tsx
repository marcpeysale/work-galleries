import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, X, ChevronLeft, ChevronRight, ImageIcon, Video } from 'lucide-react';
import { api } from '../lib/api';
import type { Project, Media, ExportResponse } from '@gallery/shared';

export const GalleryPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    Promise.all([
      api.get<Project>(`/gallery/projects/${projectId}`),
      api.get<Media[]>(`/gallery/projects/${projectId}/media`),
    ])
      .then(([p, m]) => { setProject(p); setMedia(m); })
      .finally(() => setLoading(false));
  }, [projectId]);

  const photos = media.filter((m) => m.type === 'photo');
  const videos = media.filter((m) => m.type === 'video');
  const lightboxItems = photos;

  const closeLightbox = () => setLightboxIndex(null);

  const handlePrev = useCallback(() => {
    setLightboxIndex((i) => (i !== null ? (i - 1 + lightboxItems.length) % lightboxItems.length : null));
  }, [lightboxItems.length]);

  const handleNext = useCallback(() => {
    setLightboxIndex((i) => (i !== null ? (i + 1) % lightboxItems.length : null));
  }, [lightboxItems.length]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIndex, handlePrev, handleNext]);

  const handleExport = async () => {
    if (!projectId) return;
    setExporting(true);
    setExportUrl(null);
    try {
      const result = await api.post<ExportResponse>(`/gallery/projects/${projectId}/export`, {});
      setExportUrl(result.downloadUrl);
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-bg flex items-center justify-center text-muted text-sm">Chargement…</div>;
  if (!project) return <div className="min-h-screen bg-bg flex items-center justify-center text-muted text-sm">Projet introuvable.</div>;

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border px-8 py-5 flex items-center justify-between">
        <span className="font-display text-2xl tracking-wider">MARC PEYSALE</span>
        <Link to="/" aria-label="Retour aux projets" className="flex items-center gap-1.5 text-xs text-muted hover:text-text-primary transition-colors uppercase tracking-widest">
          <ArrowLeft size={13} aria-hidden="true" /> Mes projets
        </Link>
      </header>

      <main className="px-8 py-12 max-w-wrap mx-auto">
        <div className="flex items-start justify-between mb-10 gap-4">
          <div>
            <p className="text-xs text-accent font-semibold tracking-widest uppercase mb-2">
              {String(project.month).padStart(2, '0')}/{project.year}
            </p>
            <h1 className="font-display text-5xl tracking-wider">{project.name}</h1>
            <p className="text-muted text-sm mt-2">{media.length} fichier{media.length > 1 ? 's' : ''}</p>
          </div>

          {media.length > 0 && (
            <div className="shrink-0 pt-2">
              {exportUrl ? (
                <a
                  href={exportUrl}
                  download
                  className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold tracking-widest uppercase px-5 py-2.5 transition-colors"
                >
                  <Download size={14} aria-hidden="true" /> Télécharger le ZIP
                </a>
              ) : (
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  aria-label="Préparer le téléchargement"
                  className="inline-flex items-center gap-2 bg-elevated hover:bg-elevated/80 border border-border text-text-primary text-xs font-semibold tracking-widest uppercase px-5 py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exporting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                      Préparation…
                    </>
                  ) : (
                    <>
                      <Download size={14} aria-hidden="true" /> Tout télécharger
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {photos.length > 0 && (
          <section className="mb-14" aria-label="Photos">
            <div className="flex items-center gap-2 mb-5">
              <ImageIcon size={15} className="text-muted" aria-hidden="true" />
              <h2 className="font-display text-2xl tracking-wider">Photos</h2>
              <span className="text-xs text-faint ml-1">({photos.length})</span>
            </div>
            <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 space-y-3">
              {photos.map((photo, index) => (
                <button
                  key={photo.id}
                  onClick={() => setLightboxIndex(index)}
                  aria-label={`Agrandir ${photo.filename}`}
                  className="w-full block overflow-hidden group cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <img
                    src={photo.url}
                    alt={photo.filename}
                    loading="lazy"
                    className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </button>
              ))}
            </div>
          </section>
        )}

        {videos.length > 0 && (
          <section aria-label="Vidéos">
            <div className="flex items-center gap-2 mb-5">
              <Video size={15} className="text-muted" aria-hidden="true" />
              <h2 className="font-display text-2xl tracking-wider">Vidéos</h2>
              <span className="text-xs text-faint ml-1">({videos.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {videos.map((video) => (
                <div key={video.id} className="bg-elevated">
                  <video
                    src={video.url}
                    controls
                    preload="metadata"
                    className="w-full"
                    aria-label={video.filename}
                  />
                  <p className="px-4 py-2 text-xs text-muted truncate">{video.filename}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {media.length === 0 && (
          <div className="border border-border py-20 text-center">
            <p className="text-muted">Votre galerie sera disponible prochainement.</p>
          </div>
        )}
      </main>

      {lightboxIndex !== null && lightboxItems[lightboxIndex] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Visionneuse photo"
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            aria-label="Fermer la visionneuse"
            className="absolute top-5 right-5 text-white/60 hover:text-white transition-colors z-10"
          >
            <X size={24} />
          </button>

          {lightboxItems.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                aria-label="Photo précédente"
                className="absolute left-4 text-white/60 hover:text-white transition-colors z-10 p-3"
              >
                <ChevronLeft size={32} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                aria-label="Photo suivante"
                className="absolute right-4 text-white/60 hover:text-white transition-colors z-10 p-3"
              >
                <ChevronRight size={32} />
              </button>
            </>
          )}

          <img
            src={lightboxItems[lightboxIndex].url}
            alt={lightboxItems[lightboxIndex].filename}
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/40 text-xs">
            {lightboxIndex + 1} / {lightboxItems.length}
          </p>
        </div>
      )}
    </div>
  );
};
