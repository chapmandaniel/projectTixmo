import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import AssetUploader, { validateFile } from '../components/AssetUploader';

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

describe('AssetUploader Validation Logic', () => {
    const maxSize = 1024 * 1024; // 1MB
    const accept = 'image/*,.pdf';

    it('should validate file size', () => {
        const smallFile = { size: 512 * 1024, type: 'image/png', name: 'test.png' };
        const largeFile = { size: 2 * 1024 * 1024, type: 'image/png', name: 'large.png' };

        expect(validateFile(smallFile, maxSize, accept)).toBeNull();
        expect(validateFile(largeFile, maxSize, accept)).toContain('File too large');
    });

    it('should validate file type (MIME wildcard)', () => {
        const validFile = { size: 100, type: 'image/jpeg', name: 'photo.jpg' };
        const invalidFile = { size: 100, type: 'text/plain', name: 'notes.txt' };

        expect(validateFile(validFile, maxSize, 'image/*')).toBeNull();
        expect(validateFile(invalidFile, maxSize, 'image/*')).toContain('not allowed');
    });

    it('should validate file type (extension)', () => {
        const validFile = { size: 100, type: 'application/octet-stream', name: 'doc.pdf' };
        const invalidFile = { size: 100, type: 'application/octet-stream', name: 'doc.doc' };

        expect(validateFile(validFile, maxSize, '.pdf')).toBeNull();
        expect(validateFile(invalidFile, maxSize, '.pdf')).toContain('not allowed');
    });

    it('should return null if accept is not provided or set to *', () => {
        const file = { size: 100, type: 'text/plain', name: 'test.txt' };
        expect(validateFile(file, maxSize, '*')).toBeNull();
        expect(validateFile(file, maxSize, '')).toBeNull();
    });
});

describe('AssetUploader Component', () => {
    const mockOnUpload = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should show error when oversized file is selected', async () => {
        render(<AssetUploader onUpload={mockOnUpload} maxSize={100} />);

        const file = new File(['content'], 'large.png', { type: 'image/png' });
        // Manually set a large size since File constructor size is based on content
        Object.defineProperty(file, 'size', { value: 1000 });

        const input = screen.getByDisplayValue('').closest('div').querySelector('input[type="file"]');
        fireEvent.change(input, { target: { files: [file] } });

        await waitFor(() => {
            expect(screen.getByText(/File too large/i)).toBeInTheDocument();
        });
    });

    it('should show error when invalid file type is dropped', async () => {
        render(<AssetUploader onUpload={mockOnUpload} accept="image/*" />);

        const file = new File(['content'], 'test.txt', { type: 'text/plain' });
        const dropZone = screen.getByText(/Drop files here/i).parentElement;

        fireEvent.drop(dropZone, {
            dataTransfer: {
                files: [file],
                types: ['Files']
            }
        });

        await waitFor(() => {
            expect(screen.getByText(/not allowed/i)).toBeInTheDocument();
        });
    });

    it('should add valid files to the list', async () => {
        const { container } = render(<AssetUploader onUpload={mockOnUpload} />);

        const file = new File(['content'], 'test.png', { type: 'image/png' });
        const input = container.querySelector('input[type="file"]');

        fireEvent.change(input, { target: { files: [file] } });

        await waitFor(() => {
            expect(screen.getByText('test.png')).toBeInTheDocument();
        });
    });

    it('should call onUpload when upload button is clicked', async () => {
        const { container } = render(<AssetUploader onUpload={mockOnUpload} />);

        const file = new File(['content'], 'test.png', { type: 'image/png' });
        const input = container.querySelector('input[type="file"]');

        fireEvent.change(input, { target: { files: [file] } });

        await waitFor(() => {
            expect(screen.getByText(/Upload 1 File/i)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText(/Upload 1 File/i));

        await waitFor(() => {
            expect(mockOnUpload).toHaveBeenCalled();
        });
    });
});
