declare module 'react-native-maps' {
  import { Component, ComponentType, RefObject } from 'react';
  import { ViewProps } from 'react-native';

  export const PROVIDER_GOOGLE: 'google';
  
  export interface MapViewProps extends ViewProps {
    ref?: RefObject<any>;
    provider?: 'google' | null;
    initialRegion?: Region;
    region?: Region;
    onRegionChange?: (region: Region) => void;
    onRegionChangeComplete?: (region: Region) => void;
    showsUserLocation?: boolean;
    showsMyLocationButton?: boolean;
    zoomEnabled?: boolean;
    scrollEnabled?: boolean;
    pitchEnabled?: boolean;
    rotateEnabled?: boolean;
    style?: any;
    customMapStyle?: any[];
    loadingEnabled?: boolean;
    loadingBackgroundColor?: string;
    loadingIndicatorColor?: string;
    minZoomLevel?: number;
    maxZoomLevel?: number;
    toolbarEnabled?: boolean;
    compassEnabled?: boolean;
    mapType?: 'standard' | 'satellite' | 'hybrid' | 'terrain' | 'none';
  }

  export interface Region {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }

  export interface MarkerProps {
    coordinate: { latitude: number; longitude: number };
    title?: string;
    description?: string;
    pinColor?: string;
    identifier?: string;
    onPress?: () => void;
    children?: React.ReactNode;
  }

  export interface CalloutProps {
    children?: React.ReactNode;
    tooltip?: boolean;
  }

  export const MapView: ComponentType<MapViewProps>;
  export const Marker: ComponentType<MarkerProps>;
  export const Callout: ComponentType<CalloutProps>;
  export const Polyline: ComponentType<any>;
  export const Polygon: ComponentType<any>;
  export const Circle: ComponentType<any>;
}
