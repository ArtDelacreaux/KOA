import useRepositoryState from '../repository/useRepositoryState';

export default function useLocalStorageState(key, initialValue) {
  return useRepositoryState(key, initialValue);
}
