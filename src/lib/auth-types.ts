export type AppUser = {
  id: string;
  email: string;
  user_metadata: {
    role: 'admin' | 'company' | 'reviewer';
    [key: string]: unknown;
  };
  app_metadata: {
    role: 'admin' | 'company' | 'reviewer';
  };
};

export type AppSession = {
  user: AppUser;
  expires_at: number;
};

export type AuthResult<T> = {
  data: T;
  error: { message: string } | null;
};
