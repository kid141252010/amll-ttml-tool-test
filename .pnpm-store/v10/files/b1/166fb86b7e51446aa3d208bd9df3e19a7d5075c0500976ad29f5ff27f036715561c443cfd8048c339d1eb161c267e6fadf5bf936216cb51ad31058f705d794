declare class JyutpingConverter {
    readonly getJyutpingList: typeof getJyutpingList;
    readonly getJyutping: typeof getJyutping;
    readonly getJyutpingText: typeof getJyutpingText;
    readonly getJyutpingCandidates: typeof getJyutpingCandidates;
    readonly getIPAList: typeof getIPAList;
    readonly getIPA: typeof getIPA;
    readonly getIPAText: typeof getIPAText;
    readonly getIPACandidates: typeof getIPACandidates;
    readonly customize: typeof customize;
    /** This method exists purely due to compatibility. It is the same across all `JyutpingConverter` instances. */
    readonly jyutpingToIPA: typeof jyutpingToIPA;
}
declare const ToJyutping: JyutpingConverter;

declare const getJyutpingList: (s: string) => [string, string | null][];
declare const getJyutping: (s: string) => string;
declare const getJyutpingText: (s: string) => string;
declare const getJyutpingCandidates: (s: string) => [string, string[]][];
declare const getIPAList: (s: string) => [string, string | null][];
declare const getIPA: (s: string) => string;
declare const getIPAText: (s: string) => string;
declare const getIPACandidates: (s: string) => [string, string[]][];
declare const customize: (entries: Map<string, string[] | string | null | undefined> | Record<string, string[] | string | null | undefined>) => JyutpingConverter;
declare function jyutpingToIPA(s: string): string;

export { customize, ToJyutping as default, getIPA, getIPACandidates, getIPAList, getIPAText, getJyutping, getJyutpingCandidates, getJyutpingList, getJyutpingText, jyutpingToIPA };
