import { ReactNode } from "react";

export interface Package {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  dependencies: number;
  weeklyDownloads: string;
  links: {
    npm: string;
    homepage?: string;
    repository?: string;
  };
}

export const formatDownloads = (downloads: string): string => {
  const num = parseInt(downloads, 10);
  if (isNaN(num)) return '0';
  
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
};

export const getInstallCommand = (packageName: string, packageManager: 'npm' | 'yarn' | 'pnpm' = 'npm'): string => {
  switch (packageManager) {
    case 'yarn':
      return `yarn add ${packageName}`;
    case 'pnpm':
      return `pnpm add ${packageName}`;
    default:
      return `npm install ${packageName}`;
  }
};
