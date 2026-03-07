import { useCallback, useEffect, useRef, useState } from 'react';
import { repository } from './index';

let subscriberSeq = 0;

function nextSubscriberId() {
  subscriberSeq += 1;
  return `repo-sub-${subscriberSeq}`;
}

function cloneIfObject(value) {
  if (Array.isArray(value)) return [...value];
  if (value && typeof value === 'object') return { ...value };
  return value;
}

export default function useRepositoryState(key, initialValue) {
  const subscriberIdRef = useRef(nextSubscriberId());
  const suppressNextWriteRef = useRef(false);
  const pendingHydrationRef = useRef(null);

  const resolveFallback = () => (typeof initialValue === 'function' ? initialValue() : initialValue);

  const [value, setValue] = useState(() => {
    return repository.readJson(key, resolveFallback());
  });

  useEffect(() => {
    const fallback = resolveFallback();
    const nextValue = repository.readJson(key, fallback);
    pendingHydrationRef.current = { key, value: nextValue };
    setValue(nextValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const unsubscribe = repository.subscribe(key, (event) => {
      if (event?.meta?.sourceId === subscriberIdRef.current) return;
      if (event?.meta?.type !== 'json') return;
      suppressNextWriteRef.current = true;
      setValue((prevValue) => {
        if (Object.is(event.value, prevValue)) return cloneIfObject(event.value);
        return event.value;
      });
    });
    return unsubscribe;
  }, [key]);

  useEffect(() => {
    const pendingHydration = pendingHydrationRef.current;
    if (pendingHydration?.key === key) {
      if (Object.is(value, pendingHydration.value)) {
        pendingHydrationRef.current = null;
      }
      return;
    }
    if (suppressNextWriteRef.current) {
      suppressNextWriteRef.current = false;
      return;
    }
    if (typeof repository?.canWrite === 'function' && !repository.canWrite()) return;
    repository.writeJson(key, value, { sourceId: subscriberIdRef.current });
  }, [key, value]);

  const setPersistedValue = useCallback((nextValue) => {
    if (typeof repository?.canWrite === 'function' && !repository.canWrite()) return;
    setValue((prevValue) => {
      const resolvedValue =
        typeof nextValue === 'function'
          ? nextValue(prevValue)
          : nextValue;
      // Guard against accidental in-place mutations that return the same reference.
      if (Object.is(resolvedValue, prevValue)) return cloneIfObject(resolvedValue);
      return resolvedValue;
    });
  }, []);

  return [value, setPersistedValue];
}
