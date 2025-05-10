import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext'; // To get auth headers
import { toast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// Interface for the user data expected from the backend
interface AdminUserView {
  id: number;
  name: string | null;
  email: string;
  current_xp: number;
}

const UserListComponent: React.FC = () => {
  const { getAuthHeader } = useAuth();
  const [users, setUsers] = useState<AdminUserView[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/admin/users`, {
          method: 'GET',
          headers: {
            ...getAuthHeader(), // Important for protected endpoint
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Unauthorized: You may need to log in again.');
          }
          const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch user list. Server error.' }));
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data: AdminUserView[] = await response.json();
        setUsers(data);
      } catch (err: any) {
        console.error("Failed to fetch users:", err);
        const errMsg = err.message || 'An unknown error occurred.';
        setError(errMsg);
        toast({
          title: 'Error Fetching Users',
          description: errMsg,
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [getAuthHeader]);

  if (isLoading) {
    return <div className="p-4 text-center">Loading user list...</div>;
  }

  if (error) {
    return <div className="p-4 text-center text-red-600">Error: {error}</div>;
  }

  return (
    <div className="p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Registered Users</CardTitle>
          <CardDescription>A list of users registered on the platform.</CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p>No users found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>XP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.id}</TableCell>
                    <TableCell>{user.name || 'N/A'}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.current_xp}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserListComponent; 