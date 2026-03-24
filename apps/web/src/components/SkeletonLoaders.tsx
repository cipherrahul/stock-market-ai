/**
 * Loading Skeleton Components
 */

import React from 'react';

export const SkeletonLoader: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
  <div className="space-y-3 animate-pulse">
    {Array.from({ length: lines }).map((_, i) => (
      <div key={i} className="h-4 bg-gray-700 rounded"></div>
    ))}
  </div>
);

export const CardSkeleton: React.FC = () => (
  <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 animate-pulse">
    <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
    <div className="space-y-3">
      <div className="h-4 bg-gray-700 rounded"></div>
      <div className="h-4 bg-gray-700 rounded w-5/6"></div>
      <div className="h-4 bg-gray-700 rounded w-4/6"></div>
    </div>
  </div>
);

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="space-y-2 animate-pulse">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4">
        <div className="h-6 bg-gray-700 rounded flex-1"></div>
        <div className="h-6 bg-gray-700 rounded flex-1"></div>
        <div className="h-6 bg-gray-700 rounded flex-1"></div>
      </div>
    ))}
  </div>
);
