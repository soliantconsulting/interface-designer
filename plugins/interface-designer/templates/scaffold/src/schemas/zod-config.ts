import { en as enLocale } from "zod/locales";
import { z } from "zod/mini";

const customError: z.core.$ZodConfig["customError"] = (issue) => {
    if (issue.code === "too_small" && issue.minimum === 1) {
        return "Required";
    }

    if (issue.code === "invalid_value" && issue.values?.length === 1) {
        return "Required";
    }

    if (issue.code === "invalid_type" && issue.expected !== "undefined") {
        return "Required";
    }

    return undefined;
};

z.config({ ...enLocale(), customError });
