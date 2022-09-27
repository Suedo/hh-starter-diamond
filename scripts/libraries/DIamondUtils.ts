/* global ethers */

import {Contract} from "ethers";
import {Fragment, FunctionFragment} from "ethers/lib/utils";
import {ethers} from "hardhat";
import {IDiamondLoupe} from "../../typechain-types/interfaces";

const FacetCutAction = {Add: 0, Replace: 1, Remove: 2};

class DiamondSelectors {
    private selectors: string[];
    public contract: Contract;

    constructor(contract: Contract, selectors?: string[]) {
        this.contract = contract;
        const signatures = Object.keys(contract.interface.functions);
        if (selectors) this.selectors = selectors;
        else {
            this.selectors = signatures.reduce((acc: string[], val) => {
                if (val !== "init(bytes)") {
                    acc.push(contract.interface.getSighash(val));
                }
                return acc;
            }, []);
        }
    }

    public getSelectors() {
        return this.selectors;
    }

    public remove(functionNames: (FunctionFragment | string)[]) {
        let newSelectors = this.subset(functionNames, true); // total selectors excluding functionNames
        this.selectors = newSelectors;
        return this;
    }

    public get(functionNames: (string | FunctionFragment)[]) {
        let newSelectors = this.subset(functionNames);
        return new DiamondSelectors(this.contract, newSelectors);
    }

    /**
     *
     * @param functionNames array of function selectors to either keep or filter out, based on inverse being false, or true, respectively
     * @param inverse if true, effectively functions as 'minus', else usual 'filter' which gets values if match found with argument
     * @returns
     */
    private subset(functionNames: (string | FunctionFragment)[], inverse = false) {
        return this.selectors.filter((v) => {
            for (const functionName of functionNames) {
                if (v === this.contract.interface.getSighash(functionName)) {
                    return inverse ? false : true;
                }
            }
            return inverse ? true : false;
        });
    }
}

// get function selector from function signature
function getSelector(func: FunctionFragment | string): string {
    const abiInterface = new ethers.utils.Interface([func]);
    return abiInterface.getSighash(ethers.utils.Fragment.from(func));
}

// remove selectors using an array of signatures
function removeSelectors(selectors: DiamondSelectors, signatures: string[]) {
    const iface = new ethers.utils.Interface(signatures.map((v) => "function " + v));
    const removeSelectors = signatures.map((v) => iface.getSighash(v));
    let newSelectors = selectors.getSelectors().filter((v) => !removeSelectors.includes(v));
    return newSelectors;
}

// find a particular address position in the return value of diamondLoupeFacet.facets()
function findAddressPositionInFacets(facetAddress: string, facets: IDiamondLoupe.FacetStructOutput[]) {
    for (let i = 0; i < facets.length; i++) {
        if (facets[i].facetAddress === facetAddress) {
            return i;
        }
    }
}
export {DiamondSelectors, FacetCutAction, findAddressPositionInFacets, getSelector, removeSelectors};