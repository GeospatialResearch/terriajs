import { Feature, Polygon } from "geojson";
import { computed, makeObservable } from "mobx";
import { FeatureCollectionWithCrs } from "../../Core/GeoJson";
import { JsonObject } from "../../Core/Json";
import FunctionParameter, {
  FunctionConstructorParameters
} from "./FunctionParameter";
import { GeoJsonFunctionParameter } from "./GeoJsonParameter";
/**
 * A parameter that specifies an arbitrary layer on the globe, which has been selected.
 */
export default class SelectALayerParameter
  extends FunctionParameter<JsonObject[]>
  implements GeoJsonFunctionParameter
{
  static readonly type = "multiPolygon";
  readonly type = "multiPolygon";

  constructor(...args: FunctionConstructorParameters) {
    super(...args);
    makeObservable(this);
  }

  static formatValueForUrl(value: FeatureCollectionWithCrs) {
    return JSON.stringify(value);
  }

  static getGeoJsonFeature(value: any): Feature<Polygon>[] {
    return value.features;
  }

  @computed get geoJsonFeature() {
    return SelectALayerParameter.getGeoJsonFeature(this.value);
  }
}
