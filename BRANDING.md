# Messier Brand Guide

## Brand Identity

**Messier** is a professional housekeeping management platform for vacation rentals, Airbnb properties, and short-term stays.

## Logo

### Primary Logo
- **File**: `/public/logo.svg`
- **Usage**: Marketing materials, website header, presentations
- **Clear space**: Minimum 20% of logo height on all sides

### Icon/Mark
- **File**: `/public/logo-mark.svg`
- **Usage**: App icons, favicons, social media avatars
- **Sizes**: 32px (favicon), 192px (PWA), 512px (PWA)

## Colors

### Primary Colors
| Name | Hex | Usage |
|------|-----|-------|
| Primary Sky | `#0ea5e9` | Primary buttons, links, active states |
| Primary Dark | `#0284c7` | Hover states, headers |

### Accent Colors
| Name | Hex | Usage |
|------|-----|-------|
| Gold/Sparkle | `#fbbf24` | Premium features, highlights |
| Success | `#22c55e` | Completed status, success messages |
| Warning | `#f59e0b` | Pending status, alerts |
| Danger | `#ef4444` | Errors, issues |

### Neutral Colors
| Name | Hex | Usage |
|------|-----|-------|
| White | `#ffffff` | Backgrounds, cards |
| Gray 50 | `#f9fafb` | Page backgrounds |
| Gray 100 | `#f3f4f6` | Hover states |
| Gray 500 | `#6b7280` | Secondary text |
| Gray 900 | `#111827` | Primary text |

## Typography

### Font Family
- **Primary**: Inter (Google Fonts)
- **Fallback**: system-ui, sans-serif

### Font Weights
- Regular: 400 (body text)
- Medium: 500 (labels, buttons)
- Semibold: 600 (headings)
- Bold: 700 (titles)

### Type Scale
- Display: `2rem` (32px) - Page titles
- H1: `1.5rem` (24px) - Section headers
- H2: `1.25rem` (20px) - Card titles
- H3: `1rem` (16px) - Subsections
- Body: `0.875rem` (14px) - Regular text
- Caption: `0.75rem` (12px) - Helper text

## Spacing

Use Tailwind CSS spacing scale:
- `1` = 0.25rem (4px)
- `2` = 0.5rem (8px)
- `3` = 0.75rem (12px)
- `4` = 1rem (16px)
- `6` = 1.5rem (24px)
- `8` = 2rem (32px)

## Components

### Buttons
- **Primary**: `bg-primary-600 text-white hover:bg-primary-700`
- **Secondary**: `bg-gray-100 text-gray-900 hover:bg-gray-200`
- **Danger**: `bg-red-600 text-white hover:bg-red-700`
- **Rounded**: `rounded-lg` (8px radius)

### Cards
- Background: `bg-white`
- Shadow: `shadow-sm`
- Radius: `rounded-xl` (12px)
- Padding: `p-6` (24px)

### Form Inputs
- Border: `border-gray-300`
- Focus: `focus:ring-2 focus:ring-primary-500 focus:border-transparent`
- Radius: `rounded-lg` (8px)

## Icon Guidelines

- Use Lucide icons consistently
- Size: 20px for inline, 24px for standalone
- Color: Match text color or use primary color

## App Name Usage

- **Full**: "Messier - Property Housekeeping"
- **Short**: "Messier"
- **Tagline**: "Housekeeping made simple"

## Social Media

- **Handle**: @messierapp
- **Bio**: Professional housekeeping management for vacation rentals

## Files

```
public/
├── logo.svg           # Primary logo (512x512)
├── logo-mark.svg      # Icon only (512x512)
├── icon-192.png       # PWA icon (192x192)
├── icon-512.png       # PWA icon (512x512)
├── apple-touch-icon.png  # iOS (180x180)
├── favicon-32.png     # Browser tab (32x32)
├── favicon-16.png     # Browser tab (16x16)
└── og-image.png       # Social sharing (1200x630)
```