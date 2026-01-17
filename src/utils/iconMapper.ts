import {
  // Bilan icons
  HeartPulse,
  BatteryCharging,
  Droplet,
  UserPlus,
  ShieldCheck,
  Activity,
  Waves,
  Gem,
  Mars,
  // Category icons
  TestTube2,
  Heart,
  Brain,
  Bone,
  Pill,
  Microscope,
  Dna,
  Stethoscope,
  Syringe,
  Zap,
  Eye,
  Baby,
  Users,
  Thermometer,
  type LucideIcon
} from 'lucide-react';

// Icon map for bilan icons (test packs)
const bilanIconMap: Record<string, LucideIcon> = {
  'heart_pulse': HeartPulse,
  'battery_charging': BatteryCharging,
  'drop': Droplet,
  'user_plus': UserPlus,
  'shield_check': ShieldCheck,
  'activity': Activity,
  'water': Waves,
  'rings': Gem,
  'mars': Mars,
};

// Icon map for category icons (auto-generated based on common medical categories)
const categoryIconMap: Record<string, LucideIcon> = {
  // Hématologie / Blood tests
  'hématologie': TestTube2,
  'hematology': TestTube2,
  'sang': TestTube2,
  'blood': TestTube2,

  // Cardiologie / Cardiology
  'cardiologie': Heart,
  'cardiology': Heart,
  'coeur': Heart,
  'heart': Heart,

  // Neurologie / Neurology
  'neurologie': Brain,
  'neurology': Brain,
  'cerveau': Brain,
  'brain': Brain,

  // Orthopédie / Orthopedics
  'orthopédie': Bone,
  'orthopedics': Bone,
  'os': Bone,
  'bone': Bone,

  // Pharmacologie / Pharmacology
  'pharmacologie': Pill,
  'pharmacology': Pill,
  'médicaments': Pill,
  'drugs': Pill,

  // Microbiologie / Microbiology
  'microbiologie': Microscope,
  'microbiology': Microscope,
  'bactériologie': Microscope,
  'bacteriology': Microscope,

  // Génétique / Genetics
  'génétique': Dna,
  'genetics': Dna,
  'adn': Dna,
  'dna': Dna,

  // Diabète / Diabetes
  'diabète': Syringe,
  'diabetes': Syringe,
  'glycémie': Droplet,
  'glucose': Droplet,

  // Hormones / Hormones
  'hormones': Zap,
  'endocrinologie': Zap,
  'endocrinology': Zap,

  // Thyroïde / Thyroid
  'thyroïde': Gem,
  'thyroid': Gem,

  // Immunologie / Immunology
  'immunologie': ShieldCheck,
  'immunology': ShieldCheck,
  'immunité': ShieldCheck,
  'immunity': ShieldCheck,

  // Ophtalmologie / Ophthalmology
  'ophtalmologie': Eye,
  'ophthalmology': Eye,
  'yeux': Eye,
  'eyes': Eye,

  // Pédiatrie / Pediatrics
  'pédiatrie': Baby,
  'pediatrics': Baby,
  'enfants': Baby,
  'children': Baby,

  // Infectiologie / Infectious diseases
  'infectiologie': Thermometer,
  'infectious': Thermometer,
  'infections': Thermometer,

  // Allergologie / Allergology
  'allergologie': Waves,
  'allergology': Waves,
  'allergies': Waves,

  // Gériatrie / Geriatrics
  'gériatrie': Users,
  'geriatrics': Users,

  // Fallback
  'default': Stethoscope,
};

/**
 * Maps a bilan icon name string to its corresponding Lucide React component
 * @param iconName - The name of the icon (e.g., "heart_pulse", "battery_charging")
 * @returns The corresponding LucideIcon component, or Activity as fallback
 */
export const getIconComponent = (iconName: string): LucideIcon => {
  return bilanIconMap[iconName] || Activity;
};

/**
 * Maps a category name to its corresponding Lucide React icon component
 * Supports French and English category names (case-insensitive)
 * @param categoryName - The category name (e.g., "Hématologie", "Cardiologie")
 * @returns The corresponding LucideIcon component, or Stethoscope as fallback
 */
export const getCategoryIcon = (categoryName: string): LucideIcon => {
  const normalized = categoryName.toLowerCase().trim();
  return categoryIconMap[normalized] || categoryIconMap['default'];
};
