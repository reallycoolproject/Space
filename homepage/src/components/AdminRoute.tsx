import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';

interface AdminRouteProps {
  children: ReactNode;
}

const AdminRoute = ({ children }: AdminRouteProps) => {
  const adminToken = localStorage.getItem('admin_token');
  
  // If not authenticated, cloaked redirect to home so route presence is completely hidden
  if (!adminToken) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

export default AdminRoute;
