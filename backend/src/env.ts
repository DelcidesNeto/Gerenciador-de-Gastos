export type Env = {
  APPLICATIONS: R2Bucket;
  JWT_SECRET: string;
  CORS_ORIGINS: string;
  R2_PREFIX: string;
};

export type AppVariables = {
  userId: string;
  userEmail: string;
};
