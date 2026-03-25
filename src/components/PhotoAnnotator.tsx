'use client';
import { useState, useRef, useEffect, useCallback } from 'react';

interface PhotoAnnotatorProps {
  imageUrl: string;
  onSave: (annotatedBlob: Blob) => void;
  onCancel: () => void;
}

type Tool = 'draw' | 'circle' | 'arrow' | 'text';
type DrawAction = {
  tool: Tool;
  color: string;
  lineWidth: number;
  points?: { x: number; y: number }[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  text?: string;
  fontSize?: number;
};

export default function PhotoAnnotator({ imageUrl, onSave, onCancel }: PhotoAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>('draw');
  const [color, setColor] = useState('#ef4444'); // red default
  const [lineWidth, setLineWidth] = useState(4);
  const [actions, setActions] = useState<DrawAction[]>([]);
  const [currentAction, setCurrentAction] = useState<DrawAction | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  // Track the natural image size for export
  const naturalSize = useRef({ width: 0, height: 0 });

  // Load the image
  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      naturalSize.current = { width: img.naturalWidth, height: img.naturalHeight };
      setImgLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Size canvas to fit container while maintaining aspect ratio
  useEffect(() => {
    if (!imgLoaded || !containerRef.current || !imgRef.current) return;

    const updateSize = () => {
      const container = containerRef.current;
      if (!container || !imgRef.current) return;
      const maxW = container.clientWidth;
      const maxH = window.innerHeight * 0.6;
      const imgW = imgRef.current.naturalWidth;
      const imgH = imgRef.current.naturalHeight;
      const scale = Math.min(maxW / imgW, maxH / imgH, 1);
      setCanvasSize({ width: Math.round(imgW * scale), height: Math.round(imgH * scale) });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [imgLoaded]);

  // Redraw canvas whenever actions change
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !imgRef.current) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgRef.current, 0, 0, canvas.width, canvas.height);

    const allActions = currentAction ? [...actions, currentAction] : actions;
    for (const action of allActions) {
      ctx.strokeStyle = action.color;
      ctx.fillStyle = action.color;
      ctx.lineWidth = action.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (action.tool === 'draw' && action.points && action.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(action.points[0].x, action.points[0].y);
        for (let i = 1; i < action.points.length; i++) {
          ctx.lineTo(action.points[i].x, action.points[i].y);
        }
        ctx.stroke();
      } else if (action.tool === 'circle' && action.start && action.end) {
        const rx = Math.abs(action.end.x - action.start.x) / 2;
        const ry = Math.abs(action.end.y - action.start.y) / 2;
        const cx = (action.start.x + action.end.x) / 2;
        const cy = (action.start.y + action.end.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (action.tool === 'arrow' && action.start && action.end) {
        const dx = action.end.x - action.start.x;
        const dy = action.end.y - action.start.y;
        const angle = Math.atan2(dy, dx);
        const headLen = Math.max(15, action.lineWidth * 4);
        // Line
        ctx.beginPath();
        ctx.moveTo(action.start.x, action.start.y);
        ctx.lineTo(action.end.x, action.end.y);
        ctx.stroke();
        // Arrowhead
        ctx.beginPath();
        ctx.moveTo(action.end.x, action.end.y);
        ctx.lineTo(action.end.x - headLen * Math.cos(angle - Math.PI / 6), action.end.y - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(action.end.x, action.end.y);
        ctx.lineTo(action.end.x - headLen * Math.cos(angle + Math.PI / 6), action.end.y - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      } else if (action.tool === 'text' && action.start && action.text) {
        const fs = action.fontSize || 18;
        ctx.font = `bold ${fs}px sans-serif`;
        // Text background for readability
        const metrics = ctx.measureText(action.text);
        const pad = 4;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(action.start.x - pad, action.start.y - fs - pad, metrics.width + pad * 2, fs + pad * 2);
        ctx.fillStyle = action.color;
        ctx.fillText(action.text, action.start.x, action.start.y);
      }
    }
  }, [actions, currentAction]);

  useEffect(() => {
    redraw();
  }, [redraw, canvasSize]);

  // Get position from mouse/touch event relative to canvas
  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (tool === 'text') {
      const pos = getPos(e);
      setTextPos(pos);
      return;
    }
    e.preventDefault();
    setIsDrawing(true);
    const pos = getPos(e);
    if (tool === 'draw') {
      setCurrentAction({ tool, color, lineWidth, points: [pos] });
    } else {
      setCurrentAction({ tool, color, lineWidth, start: pos, end: pos });
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !currentAction) return;
    e.preventDefault();
    const pos = getPos(e);
    if (tool === 'draw') {
      setCurrentAction(prev => prev ? { ...prev, points: [...(prev.points || []), pos] } : null);
    } else {
      setCurrentAction(prev => prev ? { ...prev, end: pos } : null);
    }
  };

  const handleEnd = () => {
    if (!isDrawing || !currentAction) return;
    setIsDrawing(false);
    setActions(prev => [...prev, currentAction]);
    setCurrentAction(null);
  };

  const handleTextSubmit = () => {
    if (!textPos || !textInput.trim()) {
      setTextPos(null);
      setTextInput('');
      return;
    }
    const fontSize = Math.max(14, Math.round(canvasSize.width / 25));
    setActions(prev => [...prev, {
      tool: 'text',
      color,
      lineWidth,
      start: textPos,
      text: textInput.trim(),
      fontSize,
    }]);
    setTextPos(null);
    setTextInput('');
  };

  const handleUndo = () => {
    setActions(prev => prev.slice(0, -1));
  };

  const handleSave = () => {
    // Export at full resolution
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = naturalSize.current.width;
    exportCanvas.height = naturalSize.current.height;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx || !imgRef.current) return;

    const scaleX = naturalSize.current.width / canvasSize.width;
    const scaleY = naturalSize.current.height / canvasSize.height;

    ctx.drawImage(imgRef.current, 0, 0);

    for (const action of actions) {
      ctx.strokeStyle = action.color;
      ctx.fillStyle = action.color;
      ctx.lineWidth = action.lineWidth * scaleX;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (action.tool === 'draw' && action.points && action.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(action.points[0].x * scaleX, action.points[0].y * scaleY);
        for (let i = 1; i < action.points.length; i++) {
          ctx.lineTo(action.points[i].x * scaleX, action.points[i].y * scaleY);
        }
        ctx.stroke();
      } else if (action.tool === 'circle' && action.start && action.end) {
        const rx = Math.abs(action.end.x - action.start.x) / 2 * scaleX;
        const ry = Math.abs(action.end.y - action.start.y) / 2 * scaleY;
        const cx = (action.start.x + action.end.x) / 2 * scaleX;
        const cy = (action.start.y + action.end.y) / 2 * scaleY;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (action.tool === 'arrow' && action.start && action.end) {
        const sx = action.start.x * scaleX;
        const sy = action.start.y * scaleY;
        const ex = action.end.x * scaleX;
        const ey = action.end.y * scaleY;
        const angle = Math.atan2(ey - sy, ex - sx);
        const headLen = Math.max(20, action.lineWidth * 5) * scaleX;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - headLen * Math.cos(angle - Math.PI / 6), ey - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - headLen * Math.cos(angle + Math.PI / 6), ey - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      } else if (action.tool === 'text' && action.start && action.text) {
        const fs = (action.fontSize || 18) * scaleX;
        ctx.font = `bold ${fs}px sans-serif`;
        const metrics = ctx.measureText(action.text);
        const pad = 4 * scaleX;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(action.start.x * scaleX - pad, action.start.y * scaleY - fs - pad, metrics.width + pad * 2, fs + pad * 2);
        ctx.fillStyle = action.color;
        ctx.fillText(action.text, action.start.x * scaleX, action.start.y * scaleY);
      }
    }

    exportCanvas.toBlob((blob) => {
      if (blob) onSave(blob);
    }, 'image/jpeg', 0.9);
  };

  const tools: { id: Tool; label: string; icon: string }[] = [
    { id: 'draw', label: 'Draw', icon: '✏️' },
    { id: 'circle', label: 'Circle', icon: '⭕' },
    { id: 'arrow', label: 'Arrow', icon: '➡️' },
    { id: 'text', label: 'Text', icon: 'Aa' },
  ];

  const colors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#ffffff', '#000000'];

  if (!imgLoaded) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <p style={{ color: 'white' }}>Loading image...</p>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 1000,
      display: 'flex', flexDirection: 'column',
      padding: '0.5rem',
      boxSizing: 'border-box',
    }}>
      <style>{`
        .annotator-toolbar {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
          padding: 0.5rem;
          background: #1f2937;
          border-radius: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .annotator-tool-btn {
          padding: 0.375rem 0.625rem;
          border: 2px solid transparent;
          border-radius: 0.375rem;
          background: #374151;
          color: white;
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.25rem;
          white-space: nowrap;
        }
        .annotator-tool-btn.active {
          border-color: #3b82f6;
          background: #1e40af;
        }
        .annotator-color-btn {
          width: 1.5rem;
          height: 1.5rem;
          border-radius: 50%;
          border: 2px solid #6b7280;
          cursor: pointer;
          padding: 0;
          flex-shrink: 0;
        }
        .annotator-color-btn.active {
          border-color: white;
          box-shadow: 0 0 0 2px #3b82f6;
        }
        .annotator-action-btn {
          padding: 0.375rem 0.75rem;
          border: none;
          border-radius: 0.375rem;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
        }
        @media (max-width: 640px) {
          .annotator-toolbar {
            gap: 0.25rem;
            padding: 0.375rem;
          }
          .annotator-tool-btn {
            padding: 0.25rem 0.5rem;
            font-size: 0.7rem;
          }
          .annotator-color-btn {
            width: 1.25rem;
            height: 1.25rem;
          }
        }
      `}</style>

      {/* Toolbar */}
      <div className="annotator-toolbar">
        {tools.map(t => (
          <button
            key={t.id}
            type="button"
            className={`annotator-tool-btn ${tool === t.id ? 'active' : ''}`}
            onClick={() => setTool(t.id)}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}

        <div style={{ width: '1px', height: '1.5rem', backgroundColor: '#4b5563', flexShrink: 0 }} />

        {colors.map(c => (
          <button
            key={c}
            type="button"
            className={`annotator-color-btn ${color === c ? 'active' : ''}`}
            style={{ backgroundColor: c }}
            onClick={() => setColor(c)}
          />
        ))}

        <div style={{ width: '1px', height: '1.5rem', backgroundColor: '#4b5563', flexShrink: 0 }} />

        <select
          value={lineWidth}
          onChange={e => setLineWidth(Number(e.target.value))}
          style={{
            background: '#374151', color: 'white', border: '1px solid #6b7280',
            borderRadius: '0.25rem', padding: '0.25rem', fontSize: '0.8rem',
          }}
        >
          <option value={2}>Thin</option>
          <option value={4}>Medium</option>
          <option value={8}>Thick</option>
        </select>

        <div style={{ flex: 1 }} />

        <button
          type="button"
          className="annotator-action-btn"
          style={{ backgroundColor: '#6b7280', color: 'white' }}
          onClick={handleUndo}
          disabled={actions.length === 0}
        >
          Undo
        </button>
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          style={{
            cursor: tool === 'text' ? 'text' : 'crosshair',
            touchAction: 'none',
            borderRadius: '0.25rem',
          }}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
        />

        {/* Text input popup */}
        {textPos && (
          <div style={{
            position: 'absolute',
            left: `calc(50% - ${canvasSize.width / 2}px + ${textPos.x}px)`,
            top: `calc(50% - ${canvasSize.height / 2}px + ${textPos.y}px)`,
            transform: 'translate(0, -100%)',
            zIndex: 10,
          }}>
            <div style={{
              display: 'flex', gap: '0.25rem', background: '#1f2937',
              padding: '0.375rem', borderRadius: '0.375rem', boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            }}>
              <input
                type="text"
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleTextSubmit(); if (e.key === 'Escape') { setTextPos(null); setTextInput(''); } }}
                placeholder="Type label..."
                autoFocus
                style={{
                  padding: '0.25rem 0.5rem', border: '1px solid #6b7280',
                  borderRadius: '0.25rem', fontSize: '0.875rem',
                  background: '#374151', color: 'white', width: '160px',
                }}
              />
              <button
                type="button"
                onClick={handleTextSubmit}
                style={{
                  padding: '0.25rem 0.5rem', backgroundColor: '#3b82f6', color: 'white',
                  border: 'none', borderRadius: '0.25rem', fontSize: '0.8rem', cursor: 'pointer',
                }}
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: '0.75rem',
        padding: '0.5rem', marginTop: '0.5rem',
      }}>
        <button
          type="button"
          className="annotator-action-btn"
          style={{ backgroundColor: '#6b7280', color: 'white', padding: '0.5rem 1.5rem', fontSize: '0.9rem' }}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="annotator-action-btn"
          style={{ backgroundColor: '#22c55e', color: 'white', padding: '0.5rem 1.5rem', fontSize: '0.9rem' }}
          onClick={handleSave}
        >
          Save Markup
        </button>
      </div>
    </div>
  );
}
