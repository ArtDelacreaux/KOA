import { createContext, useContext } from 'react';

const defaultAuthValue = {
  enabled: false,
  session: null,
  profile: null,
  role: 'member',
  isOwner: false,
  cloudStatus: { enabled: false },
  signOut: async () => {},
  updateUsername: async () => {},
};

export const AuthContext = createContext(defaultAuthValue);

export function useAuth() {
  return useContext(AuthContext);
}
