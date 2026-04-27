export type ServiceConfigValue = string | number | boolean | null | string[] | number[] | Record<string, unknown>;

export interface ServiceConfigField {
    key: string;
    label?: string;
    type: 'text' | 'password' | 'number' | 'select' | 'switch' | 'textarea' | 'custom';
    required?: boolean;
    placeholder?: string;
    defaultValue?: ServiceConfigValue;
    options?: Array<{ label: string; value: string | number }>;
    description?: string;
}

export interface ServiceInfo {
    id: string;
    name: string;
    display: string;
    version?: string;
    icon?: string;
    language?: Record<string, string>;
    configFields?: ServiceConfigField[];
}

export interface ServiceRequestContext {
    signal?: AbortSignal;
    timeoutMs?: number;
    traceId?: string;
}

export interface ServiceRequest<TInput = unknown> {
    provider: string;
    input: TInput;
    config?: Record<string, ServiceConfigValue>;
    context?: ServiceRequestContext;
}

export interface ServiceErrorShape {
    code: string;
    message: string;
    provider?: string;
    retriable?: boolean;
    details?: unknown;
}

export type ServiceResult<TData = unknown> =
    | {
          ok: true;
          data: TData;
          provider: string;
          raw?: unknown;
      }
    | {
          ok: false;
          error: ServiceErrorShape;
      };

export type ServiceCatalog = Record<string, ServiceInfo>;
