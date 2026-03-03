import { useEffect, useRef, useState } from 'react';
import { repository } from './index';

let subscriberSeq = 0;

function nextSubscriberId() {
  subscriberSeq += 1;
  return `repo-sub-${subscriberSeq}`;
}

export default function useRepositoryState(key, initialValue) {
  const subscriberIdRef = useRef(nextSubscriberId());
  const suppressNextWriteRef = useRef(false);

  const resolveFallback = () => (typeof initialValue === 'function' ? initialValue() : initialValue);

  const [value, setValue] = useState(() => {
    return repository.readJson(key, resolveFallback());
  });

  useEffect(() => {
    const fallback = resolveFallback();
    setValue(repository.readJson(key, fallback));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const unsubscribe = repository.subscribe(key, (event) => {
      if (event?.meta?.sourceId === subscriberIdRef.current) return;
      if (event?.meta?.type !== 'json') return;
      suppressNextWriteRef.current = true;
      setValue(event.value);
    });
    return unsubscribe;
  }, [key]);

  useEffect(() => {
    if (suppressNextWriteRef.current) {
      suppressNextWriteRef.current = false;
      return;
    }
    repository.writeJson(key, value, { sourceId: subscriberIdRef.current });
  }, [key, value]);

  return [value, setValue];
}
