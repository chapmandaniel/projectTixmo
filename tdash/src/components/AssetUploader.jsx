import React, { useCallback, useState } from 'react';
import { Upload, X, FileText, Image, File, Loader2 } from 'lucide-react';

const AssetUploader = ({
    onUpload,
    isDark,
    disabled = false,
    accept = 'image/*,.pdf,.psd,.ai,.svg',
    maxSize = 50 * 1024 * 1024, // 50MB
    multiple = true
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const validateFile = (file) => {
        if (file.size > maxSize) {
            return `File too large (max ${maxSize / 1024 / 1024}MB)`;
        }
        return null;
    };

    const processFiles = async (newFiles) => {
        const validFiles = [];
        const errors = [];

        for (const file of newFiles) {
            const error = validateFile(file);
            if (error) {
                errors.push(`${file.name}: ${error}`);
            } else {
                validFiles.push({
                    file,
                    id: Math.random().toString(36).substr(2, 9),
                    preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
                    name: file.name,
                    size: file.size,
                    type: file.type,
                });
            }
        }

        if (errors.length > 0) {
            setError(errors.join(', '));
        }

        if (validFiles.length > 0) {
            setFiles((prev) => [...prev, ...validFiles]);
        }
    };

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
        setError(null);

        const droppedFiles = Array.from(e.dataTransfer.files);
        processFiles(droppedFiles);
    }, [maxSize]);

    const handleFileSelect = (e) => {
        setError(null);
        const selectedFiles = Array.from(e.target.files || []);
        processFiles(selectedFiles);
        e.target.value = ''; // Reset input
    };

    const removeFile = (id) => {
        setFiles((prev) => {
            const toRemove = prev.find((f) => f.id === id);
            if (toRemove?.preview) {
                URL.revokeObjectURL(toRemove.preview);
            }
            return prev.filter((f) => f.id !== id);
        });
    };

    const handleUpload = async () => {
        if (files.length === 0 || disabled) return;

        try {
            setUploading(true);
            setError(null);

            const formData = new FormData();
            files.forEach((f) => formData.append('files', f.file));

            await onUpload(formData, files.map((f) => f.file));

            // Clear files after successful upload
            files.forEach((f) => {
                if (f.preview) URL.revokeObjectURL(f.preview);
            });
            setFiles([]);
        } catch (err) {
            setError(err.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const getFileIcon = (type) => {
        if (type.startsWith('image/')) return Image;
        if (type === 'application/pdf') return FileText;
        return File;
    };

    const formatSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    };

    return (
        <div className="space-y-4">
            {/* Drop Zone */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${isDragging
                        ? 'border-indigo-500 bg-indigo-500/10'
                        : isDark
                            ? 'border-gray-700 hover:border-gray-600 bg-gray-800/30'
                            : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
                <input
                    type="file"
                    multiple={multiple}
                    accept={accept}
                    disabled={disabled}
                    onChange={handleFileSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <Upload className={`w-10 h-10 mx-auto mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                <p className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Drop files here or click to browse
                </p>
                <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Images, PDFs, PSD, AI, SVG (max {maxSize / 1024 / 1024}MB each)
                </p>
            </div>

            {/* Error */}
            {error && (
                <div className="p-3 rounded-lg bg-red-500/10 text-red-400 text-sm flex items-center gap-2">
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto hover:text-red-300">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* File List */}
            {files.length > 0 && (
                <div className="space-y-2">
                    {files.map((f) => {
                        const Icon = getFileIcon(f.type);
                        return (
                            <div
                                key={f.id}
                                className={`flex items-center gap-3 p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'
                                    }`}
                            >
                                {f.preview ? (
                                    <img src={f.preview} alt="" className="w-10 h-10 rounded object-cover" />
                                ) : (
                                    <div className={`w-10 h-10 rounded flex items-center justify-center ${isDark ? 'bg-gray-700' : 'bg-gray-200'
                                        }`}>
                                        <Icon className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {f.name}
                                    </p>
                                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                        {formatSize(f.size)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => removeFile(f.id)}
                                    className={`p-1 rounded hover:bg-red-500/20 text-red-400`}
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        );
                    })}

                    {/* Upload Button */}
                    <button
                        onClick={handleUpload}
                        disabled={uploading || disabled}
                        className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {uploading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Uploading...
                            </>
                        ) : (
                            <>
                                <Upload className="w-5 h-5" />
                                Upload {files.length} {files.length === 1 ? 'File' : 'Files'}
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};

export default AssetUploader;
