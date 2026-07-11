-- Migration: 20260711000009_party_contacts.sql
-- Add contact_numbers JSONB column to parties table

ALTER TABLE parties ADD COLUMN IF NOT EXISTS contact_numbers JSONB DEFAULT '[]'::jsonb;
