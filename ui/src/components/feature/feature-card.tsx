import { Feature, SampleSchema } from "@/types/feature";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { FeatureActivationSample } from "./sample";
import { Button } from "../ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { useState } from "react";
import { Textarea } from "../ui/textarea";
import { useAsyncFn } from "react-use";
import { decode } from "@msgpack/msgpack";
import camelcaseKeys from "camelcase-keys";

export const FeatureCustomInputArea = ({ feature }: { feature: Feature }) => {
  const [customInput, setCustomInput] = useState<string>("");
  const [state, submit] = useAsyncFn(async () => {
    if (!customInput) {
      alert("Please enter your input.");
      return;
    }
    return await fetch(
      `${import.meta.env.VITE_BACKEND_URL}/dictionaries/${
        feature.dictionaryName
      }/features/${feature.featureIndex}/custom?input_text=${encodeURIComponent(
        customInput
      )}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-msgpack",
        },
      }
    )
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(await res.text());
        }
        return res;
      })
      .then(async (res) => await res.arrayBuffer())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((res) => decode(new Uint8Array(res)) as any)
      .then((res) =>
        camelcaseKeys(res, {
          deep: true,
          stopPaths: ["context"],
        })
      )
      .then((res) => SampleSchema.parse(res));
  }, [customInput]);

  return (
    <div className="flex flex-col gap-4">
      <p className="font-bold">Custom Input</p>
      <Textarea
        placeholder="Type your custom input here."
        value={customInput}
        onChange={(e) =>
          setCustomInput(
            e.target.value
              .replace("⏎", "\n")
              .replace("⇥", "\t")
              .replace("↵", "\r")
          )
        }
      />
      <Button onClick={submit} disabled={state.loading}>
        Submit
      </Button>
      {state.error && <p className="text-red-500">{state.error.message}</p>}
      {state.value && (
        <>
          <FeatureActivationSample
            sample={state.value}
            sampleName="Custom Input"
            maxFeatureAct={feature.maxFeatureAct}
          />
          <p className="font-bold">
            Custom Input Max Activation:{" "}
            {Math.max(...state.value.featureActs).toFixed(3)}
          </p>
        </>
      )}
    </div>
  );
};

export const FeatureCard = ({ feature }: { feature: Feature }) => {
  const analysisNameMap = (analysisName: string) => {
    if (analysisName === "top_activations") {
      return "Top Activations";
    } else if (/^subsample-/.test(analysisName)) {
      const [, proportion] = analysisName.split("-");
      const percentage = parseFloat(proportion) * 100;
      return `Subsample ${percentage}%`;
    }
  };

  const [showCustomInput, setShowCustomInput] = useState<boolean>(false);

  return (
    <Card className="container">
      <CardHeader>
        <CardTitle className="flex justify-between items-center text-xl">
          <span>
            #{feature.featureIndex}{" "}
            <span className="font-medium">
              (Activation Times ={" "}
              <span className="font-bold">{feature.actTimes}</span>)
            </span>
          </span>
          <Button onClick={() => setShowCustomInput((prev) => !prev)}>
            {showCustomInput ? "Hide Custom Input" : "Try Custom Input"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {showCustomInput && <FeatureCustomInputArea feature={feature} />}
          <div className="flex flex-col w-full gap-4">
            <Tabs defaultValue="top_activations">
              <TabsList className="font-bold">
                {feature.sampleGroups.map((sampleGroup) => (
                  <TabsTrigger
                    key={`tab-trigger-${sampleGroup.analysisName}`}
                    value={sampleGroup.analysisName}
                  >
                    {analysisNameMap(sampleGroup.analysisName)}
                  </TabsTrigger>
                ))}
              </TabsList>
              {feature.sampleGroups.map((sampleGroup) => (
                <TabsContent
                  key={`tab-content-${sampleGroup.analysisName}`}
                  value={sampleGroup.analysisName}
                  className="mt-0"
                >
                  <div className="flex flex-col gap-4 mt-4">
                    <p className="font-bold">
                      Max Activation:{" "}
                      {Math.max(...sampleGroup.samples[0].featureActs).toFixed(
                        3
                      )}
                    </p>
                    {sampleGroup.samples.slice(0, 5).map((sample, i) => (
                      <FeatureActivationSample
                        key={i}
                        sample={sample}
                        sampleName={`Sample ${i + 1}`}
                        maxFeatureAct={feature.maxFeatureAct}
                      />
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};