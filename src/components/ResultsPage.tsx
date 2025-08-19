import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Download,
  FileText,
  Eye,
  AlertTriangle,
} from "lucide-react";

interface QuestionResult {
  questionNumber: number;
  score: number;
  maxScore: number;
  isCorrect: boolean;
  isOpenEnded: boolean;
  feedback: string;
}

interface GradingResult {
  studentName: string;
  studentSurname: string;
  journalNumber: string;
  score: number;
  maxScore: number;
  grade: string;
  feedback: string;
  incorrectQuestions: number[];
  questionDetails?: QuestionResult[];
}

const ResultsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const results: GradingResult[] = location.state?.results || [];
  const [selectedResult, setSelectedResult] = useState<GradingResult | null>(
    null,
  );
  const [showQuestionDetails, setShowQuestionDetails] = useState<{
    [key: number]: boolean;
  }>({});

  const getGradeColor = (grade: string) => {
    if (grade === "Celujący") return "text-green-600";
    if (grade === "Bardzo dobry") return "text-green-500";
    if (grade === "Dobry") return "text-blue-600";
    if (grade === "Dostateczny") return "text-yellow-600";
    if (grade === "Dopuszczający") return "text-orange-600";
    return "text-red-600";
  };

  const exportResults = () => {
    const csvContent = [
      "Imię,Nazwisko,Numer z dziennika,Punkty,Maksymalne punkty,Ocena,Procent,Błędne zadania",
      ...results.map(
        (result) =>
          `${result.studentName},${result.studentSurname},${result.journalNumber},${result.score},${result.maxScore},${result.grade},${Math.round((result.score / result.maxScore) * 100)}%,"${result.incorrectQuestions.join(", ")}"`,
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "wyniki_oceniania.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (results.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <FileText className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Brak wyników
            </h2>
            <p className="text-gray-600 mb-6">
              Nie znaleziono wyników oceniania.
            </p>
            <Button
              onClick={() => navigate("/")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Powrót do głównej strony
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const averageScore =
    results.reduce((sum, r) => sum + r.score, 0) / results.length;
  const gradeDistribution = results.reduce(
    (acc, result) => {
      acc[result.grade] = (acc[result.grade] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Button
              variant="outline"
              onClick={() => navigate("/")}
              className="mb-4 flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Powrót
            </Button>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Wyniki Oceniania AI
            </h1>
            <p className="text-lg text-gray-600">
              Szczegółowe wyniki dla {results.length} uczniów
            </p>
          </div>
          <Button onClick={exportResults} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Eksportuj CSV
          </Button>
        </div>

        {/* Statistics */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Średnia klasy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {averageScore.toFixed(1)}%
              </div>
              <p className="text-sm text-gray-600">
                {averageScore.toFixed(1)} punktów średnio
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Najwyższa ocena</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {Math.max(...results.map((r) => r.score))}%
              </div>
              <p className="text-sm text-gray-600">Najlepszy wynik w klasie</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rozkład ocen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {Object.entries(gradeDistribution).map(([grade, count]) => (
                  <div key={grade} className="flex justify-between text-sm">
                    <span className={getGradeColor(grade)}>{grade}</span>
                    <span>{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle>Szczegółowe wyniki</CardTitle>
            <CardDescription>
              Indywidualne wyniki każdego ucznia z analizą AI
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.map((result, index) => (
                <div
                  key={index}
                  className="border rounded-lg p-4 space-y-3 bg-white"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-lg">
                        {result.studentName} {result.studentSurname}
                      </h4>
                      <p className="text-sm text-gray-600">
                        Numer z dziennika: {result.journalNumber}
                      </p>
                      <p className="text-sm text-gray-600">
                        Punkty: {result.score}/{result.maxScore}
                      </p>
                    </div>
                    <div
                      className={`text-right ${getGradeColor(result.grade)}`}
                    >
                      <p className="font-semibold text-lg">{result.grade}</p>
                      <p className="text-sm">
                        {Math.round((result.score / result.maxScore) * 100)}%
                      </p>
                    </div>
                  </div>

                  {result.incorrectQuestions.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-red-800 font-medium">
                          Błędne odpowiedzi w zadaniach:{" "}
                          {result.incorrectQuestions.join(", ")}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setShowQuestionDetails((prev) => ({
                              ...prev,
                              [index]: !prev[index],
                            }))
                          }
                          className="text-xs"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          {showQuestionDetails[index]
                            ? "Ukryj"
                            : "Sprawdź"}{" "}
                          szczegóły
                        </Button>
                      </div>

                      {showQuestionDetails[index] && result.questionDetails && (
                        <div className="mt-3 space-y-2">
                          {result.questionDetails
                            .filter((q) => !q.isCorrect)
                            .map((question) => (
                              <div
                                key={question.questionNumber}
                                className="bg-white border border-red-300 rounded p-2"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
                                    <span className="font-medium text-sm text-red-800">
                                      Zadanie {question.questionNumber}
                                      {question.isOpenEnded && " (otwarte)"}
                                    </span>
                                  </div>
                                  <span className="text-xs text-red-600">
                                    {question.score}/{question.maxScore} pkt
                                  </span>
                                </div>
                                <p className="text-xs text-red-700 mt-1 ml-6">
                                  {question.feedback}
                                </p>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="bg-gray-50 rounded p-3">
                    <p className="text-sm text-gray-700">
                      <strong>Analiza AI:</strong> {result.feedback}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResultsPage;
