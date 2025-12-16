import React from 'react';

const InputField = ({ label, type = "text", value, onChange, placeholder, isDark, options }) => (
    <div className="mb-4">
        <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{label}</label>
        {type === 'select' ? (
            <select
                value={value}
                onChange={onChange}
                className={`w-full p-3 rounded-lg outline-none transition-all text-sm appearance-none ${isDark ? 'bg-[#252525] text-gray-200 focus:bg-[#2a2a2a]' : 'bg-gray-50 text-gray-900 focus:bg-white shadow-sm'}`}
            >
                <option value="" disabled>Select {label}</option>
                {options?.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        ) : type === 'textarea' ? (
            <textarea
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                rows={4}
                className={`w-full p-3 rounded-lg outline-none transition-all text-sm resize-none ${isDark ? 'bg-[#252525] text-gray-200 placeholder-gray-600 focus:bg-[#2a2a2a]' : 'bg-gray-50 text-gray-900 placeholder-gray-400 focus:bg-white shadow-sm'}`}
            />
        ) : (
            <input
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className={`w-full p-3 rounded-lg outline-none transition-all text-sm ${isDark ? 'bg-[#252525] text-gray-200 placeholder-gray-600 focus:bg-[#2a2a2a]' : 'bg-gray-50 text-gray-900 placeholder-gray-400 focus:bg-white shadow-sm'}`}
            />
        )}
    </div>
);

export default InputField;
