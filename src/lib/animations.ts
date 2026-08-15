import { Variants, Transition, TargetAndTransition } from "framer-motion";

// ==========================================
// TAS ERP — Shared Motion & Animation Tokens
// ==========================================

// Page Level Transitions
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: "easeOut",
    },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: {
      duration: 0.15,
      ease: "easeIn",
    },
  },
};

export const pageTransition: Transition = {
  type: "tween",
  ease: "easeOut",
  duration: 0.2,
};

// Staggered Container for Grids, Lists, and Metrics
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
};

export const fastStaggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.03,
    },
  },
};

// Card / Grid Item Variants
export const cardVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.22,
      ease: "easeOut",
    },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: { duration: 0.15 },
  },
};

// Interactive Hover Lift for Clickable Cards & Elements
// Note: We use translateY and pure CSS variable shadow to guarantee dark mode safety
export const hoverLift: {
  rest: TargetAndTransition;
  hover: TargetAndTransition;
  tap: TargetAndTransition;
} = {
  rest: {
    y: 0,
    transition: { duration: 0.15, ease: "easeOut" },
  },
  hover: {
    y: -2,
    transition: { duration: 0.15, ease: "easeOut" },
  },
  tap: {
    y: 0,
    scale: 0.99,
    transition: { duration: 0.08 },
  },
};

// Table Row Staggered Cascading
export const tableRowVariants: Variants = {
  initial: { opacity: 0, x: -6 },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.18,
      ease: "easeOut",
    },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.1 },
  },
};

// Modal Scale & Fade In
export const modalScale: Variants = {
  initial: {
    scale: 0.95,
    opacity: 0,
    y: 8,
  },
  animate: {
    scale: 1,
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.22,
      ease: [0.16, 1, 0.3, 1], // fluid ease-out
    },
  },
  exit: {
    scale: 0.96,
    opacity: 0,
    y: 4,
    transition: {
      duration: 0.15,
      ease: "easeIn",
    },
  },
};

export const modalBackdropVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.18, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.14, ease: "easeIn" },
  },
};

// Slide-In Right Panel / Drawer
export const slideInRight: Variants = {
  initial: { x: "100%", opacity: 0.5 },
  animate: {
    x: 0,
    opacity: 1,
    transition: {
      type: "spring",
      damping: 30,
      stiffness: 320,
    },
  },
  exit: {
    x: "100%",
    opacity: 0,
    transition: {
      duration: 0.2,
      ease: "easeIn",
    },
  },
};

// Sidebar Collapsible Width Animation
export const sidebarVariants: Variants = {
  open: {
    width: 240,
    transition: { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] },
  },
  closed: {
    width: 68,
    transition: { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] },
  },
};

// Accordion Submenu Collapsible Animation
export const accordionVariants: Variants = {
  collapsed: {
    height: 0,
    opacity: 0,
    overflow: "hidden",
    transition: {
      height: { duration: 0.18, ease: "easeInOut" },
      opacity: { duration: 0.12, ease: "easeIn" },
    },
  },
  expanded: {
    height: "auto",
    opacity: 1,
    overflow: "hidden",
    transition: {
      height: { duration: 0.22, ease: "easeOut" },
      opacity: { duration: 0.2, ease: "easeOut", delay: 0.04 },
    },
  },
};

// Kanban Cards (Production Lots)
export const kanbanCardVariants: Variants = {
  initial: { opacity: 0, scale: 0.97 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.2, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    transition: { duration: 0.15 },
  },
  drag: {
    scale: 1.02,
    zIndex: 50,
  },
};

// Numeric Counters and Value Changes
export const counterVariants: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: 0.15 },
  },
};

// Toast Notifications (Fallback)
export const toastVariants: Variants = {
  initial: { x: "100%", opacity: 0 },
  animate: {
    x: 0,
    opacity: 1,
    transition: { type: "spring", damping: 25, stiffness: 350 },
  },
  exit: {
    x: "100%",
    opacity: 0,
    transition: { duration: 0.2 },
  },
};
