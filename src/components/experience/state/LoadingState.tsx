'use client';

import React from 'react';
import { Skeleton, SkeletonVariant, SkeletonDensity } from '../Skeleton';

interface LoadingStateProps {
  variant?: SkeletonVariant;
  count?: number;
  rows?: number;
  columns?: number;
  density?: SkeletonDensity;
}

export function LoadingState({
  variant = 'table',
  count,
  rows,
  columns,
  density,
}: LoadingStateProps) {
  return (
    <Skeleton
      variant={variant}
      count={count}
      rows={rows}
      columns={columns}
      density={density}
    />
  );
}
