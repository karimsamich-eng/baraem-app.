export interface UserProfile {
  id?: string;
  username: string;
  displayName: string;
  role: 'admin' | 'coordinator' | 'attendance' | 'tayo' | 'practical' | 'servant' | 'guest';
}

export interface Student {
  id: string;
  name: string;
  gradeLevel: string;
  phone?: string;
  parentName?: string;
  parentPhone?: string;
  notes?: string;
  annualNotes?: string;
  photoUrl?: string | null;
  createdAt: string;
  createdBy: string;
  attendancePoints: number;
  behaviorPoints: number;
  interactionPoints: number;
  practicalPoints: number;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  notes?: string;
  updatedAt: string;
  updatedBy: string;
}

export interface GradeRecord {
  id: string;
  studentId: string;
  subject: string;
  score: number;
  date: string;
  notes?: string;
  updatedAt: string;
  updatedBy: string;
}

export interface Resource {
  id: string;
  title: string;
  category: 'Menahej' | 'Alhan' | 'Spiritual';
  squad: 'الفرقة الأولى' | 'الفرقة الثانية';
  link: string;
  updatedAt: string;
  updatedBy: string;
}

export interface Curriculum {
  id: string;
  pdfUrl: string;
  updatedAt: string;
  updatedBy: string;
}

export interface SliderImage {
  id: string;
  imageUrl: string;
  caption?: string;
  createdAt: string;
  createdBy: string;
}

export interface Report {
  id: string;
  title: string;
  type: 'attendance' | 'tayo' | 'practical';
  reportDataJson: string;
  createdAt: string;
  createdBy: string;
  squad?: string;
}

export interface StaffMember {
  id: string;
  name: string;
  responsibility: string;
  role: 'القمص المسئول' | 'القس المسئول' | 'المنسق' | 'المدرسين' | 'المتدربين';
  squad: 'الأولى' | 'الثانية' | 'عام';
  imageUrl?: string;
  rating: number;
  updatedAt: string;
  updatedBy: string;
}

export interface Event {
  id: string;
  name: string;
  date: string;
  time: string;
  location: string;
  description?: string;
  imageUrl?: string;
  createdAt: string;
  createdBy: string;
}
