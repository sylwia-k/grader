import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

const Regulations = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-4">
          <Button variant="outline" onClick={() => navigate("/")} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Powrót
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Regulamin i informacje prawne</CardTitle>
            <CardDescription>Istotne informacje dotyczące korzystania z modułu oceniania AI</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 text-blue-900 border border-blue-200 rounded p-3 text-sm">
              W Polsce nauczyciel ponosi odpowiedzialność prawną za wystawione oceny.
            </div>
            <p className="text-gray-800">
              System AI ma charakter narzędzia wspierającego pracę nauczyciela i nie powinien być traktowany jako automatyczny mechanizm wystawiania ocen. Wyniki generowane przez AI są jedynie propozycją do weryfikacji przez nauczyciela.
            </p>
            <div className="bg-yellow-50 text-yellow-900 border border-yellow-200 rounded p-3 text-sm">
              "AI generuje propozycję oceny, decyzję ostateczną podejmuje nauczyciel".
            </div>
            <p className="text-gray-800">
              Identyfikacja uczniów w systemie odbywa się wyłącznie na podstawie numeru z dziennika. Imię i nazwisko mogą być wyświetlane pomocniczo, lecz nie są wykorzystywane do identyfikacji.
            </p>
            <p className="text-gray-700 text-sm">
              Więcej informacji i wytycznych dotyczących ochrony danych osobowych i odpowiedzialności oceniającej może określać statut szkoły oraz wewnętrzne procedury.
            </p>
            <div>
              <Link to="/" className="text-blue-700 hover:underline">Wróć do oceniania</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Regulations;

