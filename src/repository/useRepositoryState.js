import { useEffect, useState } from 'react';
import { repository } from './index';

export default function useRepositoryState(key, initialValue) {
  const [value, setValue] = useState(() => {
    const fallback = typeof initialValue === 'function' ? initialValue() : initialValue;
    return repository.readJson(key, fallback);
  });

  useEffect(() => {
    repository.writeJson(key, value);
  }, [key, value]);

  return [value, setValue];
}
