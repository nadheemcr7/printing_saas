import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
// Removed client-side pdf-lib and jszip to reduce bundle size
// import { PDFDocument } from "pdf-lib";
// import JSZip from "jszip";

/**
 * Merges tailwind classes safely.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generates a 3-digit random pickup code.
 */
export function generatePickupCode(): string {
  return Math.floor(100 + Math.random() * 900).toString();
}

/**
 * Formats currency to INR.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
}

/**
 * Calculates print cost based on Ridha Printers rules.
 */
// Pricing Interfaces
export interface PricingTier {
  basePrice: number;
  baseLimit: number;
  extraPrice: number;
}

export interface PricingConfig {
  bw: {
    single: PricingTier;
    double: PricingTier;
  };
  color: {
    single: PricingTier;
    double: PricingTier;
  };
}

export const DEFAULT_PRICING: PricingConfig = {
  bw: {
    single: { basePrice: 2, baseLimit: 10, extraPrice: 1 },
    double: { basePrice: 2, baseLimit: 10, extraPrice: 1.5 }
  },
  color: {
    single: { basePrice: 10, baseLimit: 0, extraPrice: 10 },
    double: { basePrice: 20, baseLimit: 0, extraPrice: 20 }
  }
};

export function calculatePrintCost(
  pages: number,
  printType: 'BW' | 'COLOR',
  sideType: 'SINGLE' | 'DOUBLE',
  pricing: PricingConfig = DEFAULT_PRICING
): number {
  const typeKey = printType === 'BW' ? 'bw' : 'color';
  const sideKey = sideType === 'SINGLE' ? 'single' : 'double';

  // Fallback safely if pricing config is incomplete
  const tier = pricing?.[typeKey]?.[sideKey] || DEFAULT_PRICING[typeKey][sideKey];

  if (pages <= tier.baseLimit) {
    return pages * tier.basePrice;
  }

  const baseCost = tier.baseLimit * tier.basePrice;
  const extraPages = pages - tier.baseLimit;
  const extraCost = extraPages * tier.extraPrice;

  return baseCost + extraCost;
}

/**
 * Parses a page range string (e.g., "1-3, 5, 10-12") and returns the total count of pages.
 */
export function parsePageRange(range: string, totalPages: number): number {
  if (!range || range.toLowerCase() === 'all') return totalPages;

  const segments = range.split(',');
  const selectedPages = new Set<number>();

  segments.forEach(segment => {
    const part = segment.trim();
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(s => parseInt(s.trim()));
      if (!isNaN(start) && !isNaN(end)) {
        const s = Math.max(1, Math.min(start, end));
        const e = Math.min(totalPages, Math.max(start, end));
        for (let i = s; i <= e; i++) {
          selectedPages.add(i);
        }
      }
    } else {
      const page = parseInt(part);
      if (!isNaN(page) && page >= 1 && page <= totalPages) {
        selectedPages.add(page);
      }
    }
  });

  return selectedPages.size > 0 ? selectedPages.size : totalPages;
}

/**
 * Detects page count via Serverless Function
 */
export async function getDocumentPageCount(file: File): Promise<number> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/analyze-pdf', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      console.warn("Server analysis failed");
      return 1;
    }

    const data = await res.json();
    return data.pages || 1;
  } catch (error) {
    console.error("Error analyzing document:", error);
    return 1;
  }
}
/**
 * Compresses an image file for faster uploads.
 */
export async function compressImage(file: File, quality: number = 0.6): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        // Maintain aspect ratio but limit size
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Compression failed"));
        }, "image/jpeg", quality);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}
