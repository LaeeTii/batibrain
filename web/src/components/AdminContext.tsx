import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getCurrentUserRole } from '../data/supabase/account';
import { AdminModal } from './AdminModal';

type AdminControls = { isAdmin: boolean; openAdmin(): void };
const AdminContext = createContext<AdminControls>({ isAdmin: false, openAdmin() {} });

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void getCurrentUserRole().then((role) => setIsAdmin(role === 'admin'));
  }, []);

  return <AdminContext.Provider value={{ isAdmin, openAdmin: () => setOpen(true) }}>
    {children}
    {open && isAdmin && <AdminModal onClose={() => setOpen(false)} />}
  </AdminContext.Provider>;
}

export function useAdminControls(): AdminControls {
  return useContext(AdminContext);
}
