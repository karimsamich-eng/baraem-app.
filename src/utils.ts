import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export const exportToPdf = async (studentName: string) => {
  const profileElement = document.getElementById("student-profile-content");
  if (!profileElement) {
    console.error("Student profile element not found!");
    return;
  }

  try {
    const canvas = await html2canvas(profileElement);
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${studentName}_Profile.pdf`);
  } catch (error) {
    console.error("Error generating PDF:", error);
  }
};

const compressImage = (base64Str: string, maxWidth = 800, maxHeight = 800): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compress as JPEG with 70% quality
    };
  });
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64 = reader.result as string;
      // Compress image if it's an image file
      if (file.type.startsWith('image/')) {
        const compressed = await compressImage(base64);
        resolve(compressed);
      } else {
        resolve(base64);
      }
    };
    reader.onerror = (error) => reject(error);
  });
};
