export interface VehicleInfo {
    make: string;
    model: string;
    year: string;
}

export interface Vehicle extends VehicleInfo {
    id: string;
    vin?: string;
    customerId: string;
    mileage?: number;
    lastService?: Date;
    notes?: string;
}
