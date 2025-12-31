'use client';

import { X } from 'lucide-react';

export default function OmniflowLogo() {
  const handleDelete = () => {
    window.location.href = 'https://www.omniflow.team/pricing';
  };

  // Only show logo for FREE tier users
  if (process.env.NEXT_PUBLIC_SUBSCRIPTION_TIER != 'FREE') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 group">
      <div className="relative">
        {/* Delete button */}
        <button
          onClick={handleDelete}
          className="absolute -top-2 -right-2 bg-white hover:bg-gray-100 rounded-full shadow-md transition-all duration-200 opacity-0 group-hover:opacity-100 z-10"
          aria-label="Remove logo"
        >
          <X className="w-3 h-3 text-gray-700" style={{ padding: 0 }} />
        </button>

        {/* Logo */}
        <a
          href="https://www.omniflow.team"
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <img
            src="https://omniflow-team.s3.us-east-1.amazonaws.com/public_asset/Edit+with+Omniflow.png"
            alt="Edit with Omniflow"
            className="w-32 h-auto hover:scale-105 transition-transform duration-200"
          />
        </a>
      </div>
    </div>
  );
}
