'use client';

import { Profile, Experience, Resume } from '@/types';

const PROFILE_KEY = 'resume_profile';
const EXPERIENCES_KEY = 'resume_experiences';
const RESUMES_KEY = 'resume_resumes';

export function loadProfile(): Profile {
  if (typeof window === 'undefined') return { targetJobs: [] };
  const p = localStorage.getItem(PROFILE_KEY);
  return p ? JSON.parse(p) : { targetJobs: [] };
}

export function saveProfile(profile: Profile): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function loadExperiences(): Experience[] {
  if (typeof window === 'undefined') return [];
  const e = localStorage.getItem(EXPERIENCES_KEY);
  return e ? JSON.parse(e) : [];
}

export function saveExperiences(experiences: Experience[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(EXPERIENCES_KEY, JSON.stringify(experiences));
}

export function loadResumes(): Resume[] {
  if (typeof window === 'undefined') return [];
  const r = localStorage.getItem(RESUMES_KEY);
  return r ? JSON.parse(r) : [];
}

export function saveResumes(resumes: Resume[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(RESUMES_KEY, JSON.stringify(resumes));
}