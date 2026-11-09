import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { Geometry, PresetId, ProcessingSettings } from '../core/types';
import { decodeFile, sampleDocument, type DocumentImage } from '../io/images';
import { ProcessingClient } from '../worker/client';
import type { WorkerResult } from '../worker/protocol';
import { editorReducer, loadPreferences, savePreferences } from './editor';

export function useEditor() {
  const [state, dispatch] = useReducer(editorReducer, undefined, loadPreferences);
  const [document, setDocument] = useState<DocumentImage | null>(null);
  const [preview, setPreview] = useState<Extract<WorkerResult, { type: 'render' }> | null>(null);
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [client] = useState(() => new ProcessingClient());
  const loadVersion = useRef(0), editVersion = useRef(0), previewVersion = useRef(0);
  useEffect(() => { savePreferences(state); }, [state.settings, state.print]);
  useEffect(() => () => { client.dispose(); }, [client]);

  const installDocument = useCallback((next: DocumentImage) => {
    editVersion.current++; previewVersion.current++;
    client.setSource(next.image); setPreview(null); setDocument(next); dispatch({ type: 'new-document' });
  }, [client]);

  // Start with an entirely local sample. Uploaded images are never saved.
  useEffect(() => {
    try { installDocument(sampleDocument()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The sample could not be loaded.'); }
  }, [installDocument]);

  const openFile = useCallback(async (file: File) => {
    const version = ++loadVersion.current;
    setLoading(true); setError(null);
    try {
      const next = await decodeFile(file);
      if (version === loadVersion.current) installDocument(next);
    } catch (cause) { if (version === loadVersion.current) setError(cause instanceof Error ? cause.message : 'The image could not be opened.'); }
    finally { if (version === loadVersion.current) setLoading(false); }
  }, [installDocument]);

  useEffect(() => {
    if (!document) return;
    const version = ++previewVersion.current;
    setProcessing(true);
    const timer = setTimeout(() => {
      void client.render(state.settings, state.geometry, 1600).then(result => {
        if (previewVersion.current === version) { setPreview(result); setProcessing(false); }
      }).catch(cause => {
        if (previewVersion.current === version) { setError(cause instanceof Error ? cause.message : 'Processing failed.'); setProcessing(false); }
      });
    }, 100);
    return () => { clearTimeout(timer); if (previewVersion.current === version) previewVersion.current++; };
  }, [client, document, state.settings, state.geometry]);

  const adjust = (patch: Partial<ProcessingSettings>) => { editVersion.current++; dispatch({ type: 'adjust', patch }); };
  const geometry = (next: Geometry) => { editVersion.current++; dispatch({ type: 'geometry', geometry: next }); };
  const reset = () => { editVersion.current++; dispatch({ type: 'reset' }); setError(null); };
  const applyPreset = async (preset: PresetId) => {
    if (!document) return;
    const version = ++editVersion.current;
    setProcessing(true); setError(null);
    try {
      const result = await client.preset(preset, state.geometry);
      if (version === editVersion.current) dispatch({ type: 'preset', preset, settings: result.settings });
    } catch (cause) { if (version === editVersion.current) setError(cause instanceof Error ? cause.message : 'The preset could not be applied.'); }
    finally { if (version === editVersion.current) setProcessing(false); }
  };
  return { state, dispatch, document, preview, processing, loading, error, setError, client, openFile, adjust, geometry, reset, applyPreset };
}
