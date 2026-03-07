import React from 'react';
import { createPortal } from 'react-dom';
import { Check, X, AlertCircle, AlertTriangle } from 'lucide-react';

interface AlertModalProps {
    isOpen: boolean;
    title?: string;
    message: string;
    type?: 'success' | 'error' | 'info' | 'warning';
    onClose: () => void;
    /** If provided, shows Cancel/Confirm buttons instead of "Got it" */
    onConfirm?: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
}

export default function AlertModal({ isOpen, title, message, type = 'info', onClose, onConfirm, confirmLabel, cancelLabel }: AlertModalProps) {
    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'success':
                return (
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                        <Check className="w-8 h-8 text-green-600" />
                    </div>
                );
            case 'error':
                return (
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                        <X className="w-8 h-8 text-red-600" />
                    </div>
                );
            case 'warning':
                return (
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
                        <AlertTriangle className="w-8 h-8 text-amber-600" />
                    </div>
                );
            default:
                return (
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                        <AlertCircle className="w-8 h-8 text-blue-600" />
                    </div>
                );
        }
    };

    const getDefaultTitle = () => {
        switch (type) {
            case 'success': return 'Success!';
            case 'error': return 'Error';
            case 'warning': return 'Warning';
            default: return 'Notice';
        }
    };

    const modal = (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[99999] p-4 text-center">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 animate-in fade-in zoom-in-95 duration-200">
                <div className="mb-2">
                    {getIcon()}
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">{title || getDefaultTitle()}</h2>
                </div>
                <p className="text-slate-600 mb-8 font-medium">{message}</p>

                {onConfirm ? (
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold rounded-lg transition-colors"
                        >
                            {cancelLabel || 'Cancel'}
                        </button>
                        <button
                            onClick={onConfirm}
                            className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors"
                        >
                            {confirmLabel || 'Leave'}
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-colors"
                    >
                        Got it
                    </button>
                )}
            </div>
        </div>
    );

    return createPortal(modal, document.body);
}
