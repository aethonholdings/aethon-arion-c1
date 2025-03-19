import { C1GradientAscentOptimiserName } from "../../constants/c1.model.constants";
import { C1ConfiguratorParamData, C1ParamSpaceDefinition } from "../../interfaces/c1.interfaces";
import {
    GradientAscentOptimiser,
    Model,
    Gradient,
    GradientAscentPartialDerivativeDTO,
    GradientAscentParameterDTO
} from "aethon-arion-pipeline";
import { C1ConfiguratorInitType } from "../../types/c1.types";

export class C1GradientAscentOptimiser extends GradientAscentOptimiser<
    C1ConfiguratorParamData,
    GradientAscentParameterDTO<C1ParamSpaceDefinition>
> {
    private _derivativeStepSize?: {
        spans: number;
        layers: number;
        gains: {
            influence: number;
            judgment: number;
            incentive: number;
        };
        actionStateProbability: number;
    };
    private graphMappings = {
        "teams": 0,
        "top-down": 1
    };

    constructor(model: Model<C1ConfiguratorParamData, GradientAscentParameterDTO<C1ParamSpaceDefinition>>, parameters: GradientAscentParameterDTO<C1ParamSpaceDefinition>) {
        super(C1GradientAscentOptimiserName, model, parameters);
    }

    getRandomInit(matrixInit: {
        influence: C1ConfiguratorInitType;
        judgment: C1ConfiguratorInitType;
        incentive: C1ConfiguratorInitType;
    }): C1ConfiguratorParamData {
        if (this._parameters && this._parameters.parameterSpaceDefinition) {
            // return a random point in the parameter space
            const randomInit = {} as C1ConfiguratorParamData;
            randomInit.spans = this._getRandomInit(
                this._parameters.parameterSpaceDefinition.spans[this._boundIndices.MIN],
                this._parameters.parameterSpaceDefinition.spans[this._boundIndices.MAX]
            );
            randomInit.layers = this._getRandomInit(
                this._parameters.parameterSpaceDefinition.layers[this._boundIndices.MIN],
                this._parameters.parameterSpaceDefinition.layers[this._boundIndices.MAX]
            );
            randomInit.gains = {
                influence: this._getRandomInit(
                    this._parameters.parameterSpaceDefinition.gains.influence[this._boundIndices.MIN],
                    this._parameters.parameterSpaceDefinition.gains.influence[this._boundIndices.MAX]
                ),
                judgment: this._getRandomInit(
                    this._parameters.parameterSpaceDefinition.gains.judgment[this._boundIndices.MIN],
                    this._parameters.parameterSpaceDefinition.gains.judgment[this._boundIndices.MAX]
                ),
                incentive: this._getRandomInit(
                    this._parameters.parameterSpaceDefinition.gains.incentive[this._boundIndices.MIN],
                    this._parameters.parameterSpaceDefinition.gains.incentive[this._boundIndices.MAX]
                )
            };
            randomInit.actionStateProbability = this._getRandomInit(
                this._parameters.parameterSpaceDefinition.actionStateProbability[this._boundIndices.MIN],
                this._parameters.parameterSpaceDefinition.actionStateProbability[this._boundIndices.MAX]
            );
            Math.random() > 0.5 ? (randomInit.graph = "top-down") : (randomInit.graph = "teams");
            randomInit.board.controlStep = false;
            randomInit.reporting.unitPayroll = 1;
            randomInit.reporting.unitPrice = 1;
            randomInit.matrixInit.influence = matrixInit.influence;
            randomInit.matrixInit.judgment = matrixInit.judgment;
            randomInit.matrixInit.incentive = matrixInit.incentive;
            return randomInit;
        } else {
            throw this._initError();
        }
    }

    getGradient(configuratorParamData: C1ConfiguratorParamData): Gradient<C1ConfiguratorParamData> {
        if (this._derivativeStepSize && this._parameters) {
            this._validateConfiguratorParamData(configuratorParamData);
            // calculate the partial derivative along each optimisation dimension
            let del = [] as Gradient<C1ConfiguratorParamData>;

            // dx(spans)
            del.push(
                this._initPartialDerivative(
                    "spans",
                    configuratorParamData.spans,
                    this._derivativeStepSize.spans,
                    this._parameters.parameterSpaceDefinition.spans
                )
            );

            // dx(layers)
            del.push(
                this._initPartialDerivative(
                    "layers",
                    configuratorParamData.layers,
                    this._derivativeStepSize.layers,
                    this._parameters.parameterSpaceDefinition.layers
                )
            );

            // dx(influence)
            const dxInfluence = {} as GradientAscentPartialDerivativeDTO<C1ConfiguratorParamData>;
            dxInfluence.configuratorParameterValueName = "gains.influence";
            del.push(
                this._initPartialDerivative(
                    "gains.influence",
                    configuratorParamData.gains.influence,
                    this._derivativeStepSize.gains.influence,
                    this._parameters.parameterSpaceDefinition.gains.influence
                )
            );

            // dx(judgment)
            del.push(
                this._initPartialDerivative(
                    "gains.judgment",
                    configuratorParamData.gains.judgment,
                    this._derivativeStepSize.gains.judgment,
                    this._parameters.parameterSpaceDefinition.gains.judgment 
                )
            );

            // dx(incentive)
            del.push(
                this._initPartialDerivative(
                    "gains.incentive",
                    configuratorParamData.gains.incentive,
                    this._derivativeStepSize.gains.incentive,
                    this._parameters.parameterSpaceDefinition.gains.incentive
                )
            );

            // dx(actionStateProbability)
            del.push(
                this._initPartialDerivative(
                    "actionStateProbability",
                    configuratorParamData.actionStateProbability,
                    this._derivativeStepSize.actionStateProbability,
                    this._parameters.parameterSpaceDefinition.actionStateProbability
                )
            );

            return del;
        } else {
            throw this._initError();
        }
    }

    getNextPoint(
        configuratorParamData: C1ConfiguratorParamData,
        gradient: Gradient<C1ConfiguratorParamData>
    ): C1ConfiguratorParamData {
        return {} as C1ConfiguratorParamData;
    }

    testConvergence(gradient: Gradient<C1ConfiguratorParamData>): boolean {
        return true;
    }

    protected _initPartialDerivative(
        valueName: string,
        initValue: any,
        stepSize: number,
        bounds: number[]
    ): GradientAscentPartialDerivativeDTO<C1ConfiguratorParamData> {
        const dx = {} as GradientAscentPartialDerivativeDTO<C1ConfiguratorParamData>;
        dx.configuratorParameterValueName = valueName;
        let tmp: number;
        tmp = stepSize;
        initValue + tmp <= bounds[this._boundIndices.MAX] ? tmp : (tmp = 0);
        dx.xDelta = tmp;
        dx.configuratorParameterValue = initValue + tmp;
        dx.status = "pending";
        // provide the configurator parameter data here -----------------------------------------------------------------
        return dx;
    }

    protected _getRandomInit(min: number, max: number): number {
        return Math.random() * (max - min) + min;
    }

    protected _validateConfiguratorParamData(configuratorParamData: C1ConfiguratorParamData): void {
        if (this._parameters) {
            // check that the point is within the parameter space
            if (
                !this._checkRange(
                    configuratorParamData.spans,
                    this._parameters.parameterSpaceDefinition.spans[this._boundIndices.MIN],
                    this._parameters.parameterSpaceDefinition.spans[this._boundIndices.MAX]
                )
            )
                throw new Error("The number of spans must be within the range of the parameter space");
            if (
                !this._checkRange(
                    configuratorParamData.layers,
                    this._parameters.parameterSpaceDefinition.layers[this._boundIndices.MIN],
                    this._parameters.parameterSpaceDefinition.layers[this._boundIndices.MAX]
                )
            )
                throw new Error("The number of layers must be within the range of the parameter space");
            if (
                !this._checkRange(
                    configuratorParamData.gains.influence,
                    this._parameters.parameterSpaceDefinition.gains.influence[this._boundIndices.MIN],
                    this._parameters.parameterSpaceDefinition.gains.influence[this._boundIndices.MAX]
                )
            )
                throw new Error("The influence gain must be within the range of the parameter space");
            if (
                !this._checkRange(
                    configuratorParamData.gains.judgment,
                    this._parameters.parameterSpaceDefinition.gains.judgment[this._boundIndices.MIN],
                    this._parameters.parameterSpaceDefinition.gains.judgment[this._boundIndices.MAX]
                )
            )
                throw new Error("The judgment gain must be within the range of the parameter space");
            if (
                !this._checkRange(
                    configuratorParamData.gains.incentive,
                    this._parameters.parameterSpaceDefinition.gains.incentive[this._boundIndices.MIN],
                    this._parameters.parameterSpaceDefinition.gains.incentive[this._boundIndices.MAX]
                )
            )
                throw new Error("The incentive gain must be within the range of the parameter space");
            if (
                !this._checkRange(
                    configuratorParamData.actionStateProbability,
                    this._parameters.parameterSpaceDefinition.actionStateProbability[this._boundIndices.MIN],
                    this._parameters.parameterSpaceDefinition.actionStateProbability[this._boundIndices.MAX]
                )
            )
                throw new Error("The action state probability must be within the range of the parameter space");
        } else {
            throw this._initError();
        }
    }

    protected _checkRange(value: number, min: number, max: number): boolean {
        return value >= min && value <= max;
    }

    protected _checkBounds() {
        if (this._parameters.parameterSpaceDefinition) {
            if (
                this._parameters.parameterSpaceDefinition.spans[this._boundIndices.MAX] <
                this._parameters.parameterSpaceDefinition.spans[this._boundIndices.MIN]
            ) {
                throw new Error("The maximum span must be greater than the minimum span");
            }
            if (
                this._parameters.parameterSpaceDefinition.layers[this._boundIndices.MAX] <
                this._parameters.parameterSpaceDefinition.layers[this._boundIndices.MIN]
            ) {
                throw new Error("The maximum layer must be greater than the minimum layer");
            }
            if (
                this._parameters.parameterSpaceDefinition.gains.influence[this._boundIndices.MAX] <
                this._parameters.parameterSpaceDefinition.gains.influence[this._boundIndices.MIN]
            ) {
                throw new Error("The maximum influence gain must be greater than the minimum influence gain");
            }
            if (
                this._parameters.parameterSpaceDefinition.gains.judgment[this._boundIndices.MAX] <
                this._parameters.parameterSpaceDefinition.gains.judgment[this._boundIndices.MIN]
            ) {
                throw new Error("The maximum judgment gain must be greater than the minimum judgment gain");
            }
            if (
                this._parameters.parameterSpaceDefinition.gains.incentive[this._boundIndices.MAX] <
                this._parameters.parameterSpaceDefinition.gains.incentive[this._boundIndices.MIN]
            ) {
                throw new Error("The maximum incentive gain must be greater than the minimum incentive gain");
            }
            if (
                this._parameters.parameterSpaceDefinition.actionStateProbability[this._boundIndices.MAX] <
                this._parameters.parameterSpaceDefinition.actionStateProbability[this._boundIndices.MIN]
            ) {
                throw new Error(
                    "The maximum action state probability must be greater than the minimum action state probability"
                );
            }
            if (
                this._parameters.parameterSpaceDefinition.actionStateProbability[this._boundIndices.MAX] <= 0 ||
                this._parameters.parameterSpaceDefinition.actionStateProbability[this._boundIndices.MAX] >= 1
            ) {
                throw new Error("The maximum action state probability must be in the range [0,1]");
            }
            if (
                this._parameters.parameterSpaceDefinition.actionStateProbability[this._boundIndices.MIN] <= 0 ||
                this._parameters.parameterSpaceDefinition.actionStateProbability[this._boundIndices.MIN] >= 1
            ) {
                throw new Error("The minimum action state probability must be in the range [0,1]");
            }
        } else {
            throw this._initError();
        }
    }

    protected _initError(): Error {
        return new Error("The optimiser has not been initialised");
    }
}
