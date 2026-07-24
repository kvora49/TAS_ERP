'use client';

import React from 'react';
import { SkeletonVariant, SkeletonDensity } from './Skeleton';
import { LoadingState } from './state/LoadingState';
import { ErrorState } from './state/ErrorState';
import { EmptyState } from './state/EmptyState';
import { PermissionState } from './state/PermissionState';
import { OfflineState } from './state/OfflineState';

export interface PageStateProps {
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  hasPermission?: boolean;
  isOffline?: boolean;

  skeletonVariant?: SkeletonVariant;
  skeletonCount?: number;
  skeletonRows?: number;
  skeletonColumns?: number;
  skeletonDensity?: SkeletonDensity;

  error?: Error | null;
  onRetry?: () => void;

  emptyIcon?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;

  children: React.ReactNode;
}

export function PageState({
  isLoading,
  isError,
  isEmpty,
  hasPermission = true,
  isOffline,
  skeletonVariant = 'table',
  skeletonCount,
  skeletonRows,
  skeletonColumns,
  skeletonDensity,
  error,
  onRetry,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  children,
}: PageStateProps) {
  if (isOffline) return <OfflineState />;
  if (!hasPermission) return <PermissionState />;
  if (isLoading)
    return (
      <LoadingState
        variant={skeletonVariant}
        count={skeletonCount}
        rows={skeletonRows}
        columns={skeletonColumns}
        density={skeletonDensity}
      />
    );
  if (isError) return <ErrorState error={error} onRetry={onRetry} />;
  if (isEmpty)
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  return <>{children}</>;
}
